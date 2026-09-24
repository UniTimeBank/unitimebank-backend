import { Injectable, Logger, BadRequestException, NotFoundException, Inject, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  PostSessionRating,
  ViolationReport,
  ReportEvidence,
  TrustScore,
  TrustScoreChange,
  ModerationDecision,
  AccountModerationAction,
} from './entities';
import {
  TrustTier,
  TrustChangeReason,
  ReportStatus,
  ReportCategory,
  ReportTargetType,
  EvidenceKind,
  ModerationDecisionType,
} from './enums';
import {
  CreateRatingDto,
  CreateViolationReportDto,
  ResolveReportDto,
  MODERATION_EVENTS,
  NOTIFICATION_EVENTS,
} from '@app/contracts';

@Injectable()
export class ModerationService implements OnModuleInit {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    @InjectRepository(PostSessionRating)
    private readonly ratingRepo: Repository<PostSessionRating>,
    @InjectRepository(ViolationReport)
    private readonly reportRepo: Repository<ViolationReport>,
    @InjectRepository(ReportEvidence)
    private readonly evidenceRepo: Repository<ReportEvidence>,
    @InjectRepository(TrustScore)
    private readonly trustScoreRepo: Repository<TrustScore>,
    @InjectRepository(TrustScoreChange)
    private readonly trustScoreChangeRepo: Repository<TrustScoreChange>,
    @InjectRepository(ModerationDecision)
    private readonly decisionRepo: Repository<ModerationDecision>,
    @InjectRepository(AccountModerationAction)
    private readonly actionRepo: Repository<AccountModerationAction>,
    @Inject('RABBITMQ_SERVICE')
    private readonly rmqClient: ClientProxy,
    @Inject('BOOKING_SERVICE')
    private readonly bookingClient: ClientProxy,
  ) { }

  async onModuleInit() {
    try {
      await this.trustScoreChangeRepo.query(`
        ALTER TABLE IF EXISTS "trust_score_change"
        DROP CONSTRAINT IF EXISTS "FK_8182546d64c6aad26aa3b544ce7";
      `);
      await this.trustScoreRepo.query(`
        DO $$
        BEGIN
          ALTER TABLE "trust_score" ADD COLUMN IF NOT EXISTS "mentor_score" INT DEFAULT 100;
          ALTER TABLE "trust_score" ADD COLUMN IF NOT EXISTS "learner_score" INT DEFAULT 100;
          ALTER TABLE "trust_score" ADD COLUMN IF NOT EXISTS "mentor_tier" VARCHAR DEFAULT 'GOOD';
          ALTER TABLE "trust_score" ADD COLUMN IF NOT EXISTS "learner_tier" VARCHAR DEFAULT 'GOOD';
          ALTER TABLE "trust_score_change" ADD COLUMN IF NOT EXISTS "role_type" VARCHAR DEFAULT 'MENTOR';

          -- Convert timestamp columns to timestamptz to avoid 7-hour timezone offset issues
          ALTER TABLE IF EXISTS "violation_report" ALTER COLUMN "submitted_at" TYPE timestamptz USING "submitted_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "violation_report" ALTER COLUMN "closed_at" TYPE timestamptz USING "closed_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "report_evidence" ALTER COLUMN "uploaded_at" TYPE timestamptz USING "uploaded_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "moderation_decision" ALTER COLUMN "decided_at" TYPE timestamptz USING "decided_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "post_session_rating" ALTER COLUMN "submitted_at" TYPE timestamptz USING "submitted_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "post_session_rating" ADD COLUMN IF NOT EXISTS "room_id" VARCHAR;
          ALTER TABLE IF EXISTS "post_session_rating" ADD COLUMN IF NOT EXISTS "session_type" VARCHAR DEFAULT 'ONE_ON_ONE';
          ALTER TABLE IF EXISTS "post_session_rating" ALTER COLUMN "booking_id" DROP NOT NULL;
          ALTER TABLE IF EXISTS "trust_score_change" ALTER COLUMN "occurred_at" TYPE timestamptz USING "occurred_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "account_moderation_action" ALTER COLUMN "occurred_at" TYPE timestamptz USING "occurred_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "trust_score" ALTER COLUMN "last_updated_at" TYPE timestamptz USING "last_updated_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "trust_score" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC';
          ALTER TABLE IF EXISTS "system_stats" ALTER COLUMN "generated_at" TYPE timestamptz USING "generated_at" AT TIME ZONE 'UTC';

          -- Relax legacy NOT NULL constraints on evidence and report tables
          ALTER TABLE IF EXISTS "report_evidence" ALTER COLUMN "recording_id" DROP NOT NULL;
          ALTER TABLE IF EXISTS "report_evidence" ALTER COLUMN "cloudinary_public_id" DROP NOT NULL;
          ALTER TABLE IF EXISTS "report_evidence" ALTER COLUMN "file_url" DROP NOT NULL;
          ALTER TABLE IF EXISTS "report_evidence" ALTER COLUMN "size_bytes" SET DEFAULT 0;
          ALTER TABLE IF EXISTS "report_evidence" ALTER COLUMN "size_bytes" DROP NOT NULL;
          ALTER TABLE IF EXISTS "violation_report" ALTER COLUMN "description" DROP NOT NULL;
          ALTER TABLE IF EXISTS "violation_report" ALTER COLUMN "target_user_id" DROP NOT NULL;
          ALTER TABLE IF EXISTS "violation_report" ALTER COLUMN "target_id" DROP NOT NULL;
          ALTER TABLE IF EXISTS "violation_report" ALTER COLUMN "closed_at" DROP NOT NULL;
        EXCEPTION
          WHEN others THEN null;
        END $$;
      `);
      this.logger.log('Moderation schema & constraints verified successfully');
    } catch (err: any) {
      this.logger.debug('Schema verification result in ModerationService:', err.message);
    }
  }

  // ==================== RATINGS & REVIEWS ====================

  private async getUserSnapshot(userId: string): Promise<{ name: string; avatar: string }> {
    try {
      const userUrl = process.env.USER_SERVICE_URL || 'http://127.0.0.1:3002';
      const res = await fetch(`${userUrl}/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        return {
          name: data.displayName || data.fullName || data.name || 'Thành viên',
          avatar: data.avatarUrl || data.avatar || '',
        };
      }
    } catch (err) {
      this.logger.debug(`Could not fetch user snapshot for ${userId}:`, err);
    }
    return { name: 'Thành viên', avatar: '' };
  }

  async createRating(reviewerId: string, dto: CreateRatingDto) {
    const stars = Math.max(1, Math.min(5, Math.round(dto.stars)));
    let targetUserId = dto.mentorId || dto.learnerId;

    // 1. Xác thực thông tin Booking từ BookingService
    if (dto.bookingId) {
      try {
        const booking = await firstValueFrom(
          this.bookingClient
            .send('booking.findById', { id: dto.bookingId })
            .pipe(timeout(5000)),
        );

        if (!booking) {
          throw new RpcException({
            status: 404,
            message: 'Không tìm thấy thông tin buổi học cần đánh giá.',
          });
        }

        if (booking.status !== 'COMPLETED') {
          throw new RpcException({
            status: 400,
            message: `Chỉ có thể đánh giá khi buổi học đã kết thúc hoàn tất (COMPLETED). Trạng thái hiện tại: ${booking.status}.`,
          });
        }

        const isLearner = String(booking.learnerId) === String(reviewerId);
        const isMentor = String(booking.mentorId) === String(reviewerId);

        if (!isLearner && !isMentor) {
          throw new RpcException({
            status: 403,
            message: 'Bạn không phải là thành viên của buổi học này để gửi đánh giá.',
          });
        }

        // Tự động xác định targetUserId nếu chưa có
        if (!targetUserId) {
          targetUserId = isLearner ? booking.mentorId : booking.learnerId;
        }
      } catch (err: any) {
        if (err instanceof RpcException) throw err;
        this.logger.warn(`Could not verify booking ${dto.bookingId} over RMQ:`, err);
      }
    }

    let reviewerName = dto.reviewerName?.trim();
    let reviewerAvatar = dto.reviewerAvatar?.trim();

    if (!reviewerName || reviewerName === 'Học viên' || reviewerName === 'Học viên UniTime') {
      const snapshot = await this.getUserSnapshot(reviewerId);
      reviewerName = snapshot.name;
      reviewerAvatar = snapshot.avatar || reviewerAvatar;
    }

    // Check if rating for this booking/room already exists
    const existing = dto.roomId
      ? await this.ratingRepo.findOne({
          where: { roomId: dto.roomId, learnerId: reviewerId },
        })
      : await this.ratingRepo.findOne({
          where: { bookingId: dto.bookingId, learnerId: reviewerId },
        });

    if (existing) {
      throw new RpcException({
        status: 400,
        message: 'Bạn đã đánh giá buổi học này rồi. Mỗi người chỉ được đánh giá 1 lần.',
      });
    }

    // Tạo đánh giá mới (mỗi học viên chỉ được đánh giá 1 lần duy nhất)
      const rating = this.ratingRepo.create({
        bookingId: dto.bookingId,
        roomId: dto.roomId,
        sessionType: dto.sessionType || (dto.roomId ? 'GROUP' : 'ONE_ON_ONE'),
        sessionId: dto.sessionId || dto.bookingId || dto.roomId,
        learnerId: reviewerId,
        mentorId: targetUserId,
        stars,
        comment: dto.comment?.trim() || undefined,
        reviewerName,
        reviewerAvatar,
      });

    const savedRating = await this.ratingRepo.save(rating);

      // Chỉ trừ điểm uy tín khi nhận đánh giá xấu
      if (stars <= 2 && targetUserId) {
        const penalty = stars === 1 ? -2 : -1;
        await this.changeTrustScore(
          targetUserId,
          penalty,
          stars === 1 ? TrustChangeReason.RATING_1_STAR : TrustChangeReason.RATING_2_STAR,
          savedRating.id,
          'POST_SESSION_RATING',
          'MENTOR',
        );
      }

    // Emit event
    this.rmqClient.emit(MODERATION_EVENTS.RATING_SUBMITTED, {
      ratingId: savedRating.id,
      bookingId: savedRating.bookingId,
      learnerId: savedRating.learnerId,
      mentorId: savedRating.mentorId,
      stars: savedRating.stars,
      comment: savedRating.comment,
      submittedAt: savedRating.submittedAt,
      reviewerName: savedRating.reviewerName,
      reviewerAvatar: savedRating.reviewerAvatar,
    });

    // Notify Mentor via Notification Service
    if (targetUserId) {
      this.rmqClient.emit(NOTIFICATION_EVENTS.CREATE, {
        userId: targetUserId,
        title: 'Đánh giá mới từ học viên ⭐',
        message: `${reviewerName || 'Học viên'} vừa gửi đánh giá ${stars} sao cho buổi học của bạn!`,
        kind: 'BOOKING',
        metadata: { bookingId: dto.bookingId, ratingId: savedRating.id, stars },
      });
    }

    return savedRating;
  }

  async getRatingsByUser(userId: string, page = 1, limit = 10) {
    const take = Math.max(1, Math.min(50, limit));
    const skip = (Math.max(1, page) - 1) * take;

    const [reviews, total] = await this.ratingRepo.findAndCount({
      where: { mentorId: userId },
      order: { submittedAt: 'DESC' },
      take,
      skip,
    });

    // Enrich reviewer info for reviews
    const enrichedReviews = await Promise.all(
      reviews.map(async (r) => {
        if (!r.reviewerName || r.reviewerName === 'Học viên UniTime' || r.reviewerName === 'Học viên') {
          const snapshot = await this.getUserSnapshot(r.learnerId);
          if (snapshot.name && snapshot.name !== 'Học viên' && snapshot.name !== 'Học viên UniTime') {
            r.reviewerName = snapshot.name;
            r.reviewerAvatar = snapshot.avatar || r.reviewerAvatar;
            this.ratingRepo.update(r.id, {
              reviewerName: snapshot.name,
              reviewerAvatar: r.reviewerAvatar,
            }).catch(() => {});
          }
        }
        return r;
      }),
    );

    // Calculate star distribution & average
    const allRatings = await this.ratingRepo.find({
      where: { mentorId: userId },
      select: { stars: true },
    });

    const starDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalStars = 0;

    for (const r of allRatings) {
      const s = Math.min(5, Math.max(1, r.stars)) as 1 | 2 | 3 | 4 | 5;
      starDistribution[s] = (starDistribution[s] || 0) + 1;
      totalStars += r.stars;
    }

    const averageRating = allRatings.length > 0
      ? Number((totalStars / allRatings.length).toFixed(1))
      : 0;

    return {
      userId,
      averageRating,
      totalReviews: allRatings.length,
      starDistribution,
      reviews: enrichedReviews,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getRatingByBooking(bookingId: string) {
    return this.ratingRepo.findOne({
      where: { bookingId },
    });
  }

  async getMyRatedSessionIds(learnerId: string) {
    return this.ratingRepo.find({
      where: { learnerId },
      select: {
        id: true,
        bookingId: true,
        roomId: true,
        sessionType: true,
        stars: true,
        comment: true,
        submittedAt: true,
      },
      order: { submittedAt: 'DESC' },
    });
  }

  // ==================== TRUST SCORE ====================

  async getOrCreateTrustScore(userId: string): Promise<TrustScore> {
    let ts = await this.trustScoreRepo.findOne({ where: { userId } });
    if (!ts) {
      ts = this.trustScoreRepo.create({
        userId,
        score: 100,
        mentorScore: 100,
        learnerScore: 100,
        tier: TrustTier.GOOD,
        mentorTier: TrustTier.GOOD,
        learnerTier: TrustTier.GOOD,
      });
      ts = await this.trustScoreRepo.save(ts);
    }
    return ts;
  }

  private calculateTier(score: number): TrustTier {
    if (score >= 80) return TrustTier.GOOD;
    if (score >= 50) return TrustTier.AVERAGE;
    if (score > 0) return TrustTier.WARNING;
    return TrustTier.LOCKED;
  }

  async changeTrustScore(
    userId: string,
    delta: number,
    reason: TrustChangeReason,
    sourceEventId?: string,
    sourceEventKind?: string,
    roleType: 'MENTOR' | 'LEARNER' = 'MENTOR',
  ) {
    const ts = await this.getOrCreateTrustScore(userId);
    let scoreBefore = 100;
    let scoreAfter = 100;

    if (roleType === 'LEARNER') {
      scoreBefore = ts.learnerScore ?? 100;
      scoreAfter = Math.max(0, Math.min(100, scoreBefore + delta));
      ts.learnerScore = scoreAfter;
      ts.learnerTier = this.calculateTier(scoreAfter);
    } else {
      scoreBefore = ts.mentorScore ?? ts.score ?? 100;
      scoreAfter = Math.max(0, Math.min(100, scoreBefore + delta));
      ts.mentorScore = scoreAfter;
      ts.score = scoreAfter;
      ts.mentorTier = this.calculateTier(scoreAfter);
      ts.tier = ts.mentorTier;
    }

    ts.lastUpdatedAt = new Date();
    await this.trustScoreRepo.save(ts);

    // Save change log
    const change = this.trustScoreChangeRepo.create({
      userId,
      trustScore: ts,
      delta,
      reason,
      roleType,
      scoreBefore,
      scoreAfter,
      sourceEventId,
      sourceEventKind,
    });
    await this.trustScoreChangeRepo.save(change);

    this.logger.log(
      `Trust score updated for user ${userId} [${roleType}]: ${scoreBefore} -> ${scoreAfter} (${delta > 0 ? '+' : ''}${delta})`,
    );

    // Emit event
    this.rmqClient.emit(MODERATION_EVENTS.TRUST_SCORE_UPDATED, {
      userId,
      score: ts.mentorScore,
      mentorScore: ts.mentorScore,
      learnerScore: ts.learnerScore,
      roleType,
      delta,
      reason,
      tier: ts.tier,
    });

    return ts;
  }

  async getTrustScore(userId: string) {
    const ts = await this.getOrCreateTrustScore(userId);
    return {
      id: ts.id,
      userId: ts.userId,
      score: ts.mentorScore ?? ts.score ?? 100,
      mentorScore: ts.mentorScore ?? ts.score ?? 100,
      learnerScore: ts.learnerScore ?? 100,
      tier: ts.mentorTier || ts.tier || 'GOOD',
      mentorTier: ts.mentorTier || 'GOOD',
      learnerTier: ts.learnerTier || 'GOOD',
      lastUpdatedAt: ts.lastUpdatedAt || new Date(),
    };
  }

  async getTrustScoreHistory(userId: string) {
    const trustScore = await this.getTrustScore(userId);
    const history = await this.trustScoreChangeRepo.find({
      where: { userId },
      order: { occurredAt: 'DESC' },
      take: 50,
    });

    return {
      trustScore,
      history,
    };
  }

  /**
   * Quản trị viên điều chỉnh điểm uy tín thủ công (kèm ghi chú và phát event đồng bộ toàn hệ thống)
   */
  async adminAdjustTrustScore(
    userId: string,
    delta: number,
    adminId: string,
    note?: string,
    roleType: 'MENTOR' | 'LEARNER' = 'MENTOR',
  ) {
    const change = await this.changeTrustScore(
      userId,
      delta,
      TrustChangeReason.ADMIN_ADJUSTMENT,
      adminId,
      note || 'ADMIN_MANUAL_ADJUSTMENT',
      roleType,
    );
    return {
      success: true,
      message: `Đã điều chỉnh ${delta > 0 ? `+${delta}` : delta} điểm uy tín [${roleType}] cho người dùng thành công`,
      change,
    };
  }

  // ==================== VIOLATION REPORTS ====================

  async createReport(reporterId: string, dto: CreateViolationReportDto) {
    let targetType = ReportTargetType.USER;
    const rawTargetType = (dto.targetType || '').toUpperCase();
    if (rawTargetType === 'POST') {
      targetType = ReportTargetType.POST;
    } else if (
      rawTargetType.includes('SESSION') ||
      rawTargetType.includes('BOOKING') ||
      rawTargetType.includes('ROOM')
    ) {
      targetType = ReportTargetType.SESSION;
    }

    let category = ReportCategory.OTHER;
    if (Object.values(ReportCategory).includes(dto.category as ReportCategory)) {
      category = dto.category as ReportCategory;
    }

    const targetUserId = dto.targetUserId?.trim() || dto.targetId?.trim() || reporterId;
    const targetId = dto.targetId?.trim() || dto.targetUserId?.trim() || reporterId;

    const report = this.reportRepo.create({
      reporterId,
      targetUserId,
      targetType,
      targetId,
      category,
      description: dto.description?.trim() || undefined,
      status: ReportStatus.OPEN,
    });

    const savedReport = await this.reportRepo.save(report);

    if (dto.evidenceUrls && dto.evidenceUrls.length > 0) {
      try {
        const evidences = dto.evidenceUrls.map((ev) => {
          const kind = ev.kind?.toUpperCase() === 'VIDEO' ? EvidenceKind.VIDEO : EvidenceKind.IMAGE;
          return this.evidenceRepo.create({
            reportId: savedReport.id,
            fileUrl: ev.url,
            kind,
            cloudinaryPublicId: (ev as any).publicId || '',
            recordingId: (ev as any).recordingId || undefined,
            sizeBytes: (ev as any).sizeBytes || (ev as any).bytes || 0,
          });
        });
        await this.evidenceRepo.save(evidences);
      } catch (evidenceErr) {
        this.logger.warn(`Could not save evidences for report ${savedReport.id}:`, evidenceErr);
      }
    }

    this.rmqClient.emit(MODERATION_EVENTS.REPORT_CREATED, {
      reportId: savedReport.id,
      reporterId: savedReport.reporterId,
      targetUserId: savedReport.targetUserId,
      targetType: savedReport.targetType,
      targetId: savedReport.targetId,
      category: savedReport.category,
    });

    return this.reportRepo.findOne({
      where: { id: savedReport.id },
      relations: { evidences: true },
    });
  }

  async getMyReports(reporterId: string) {
    const reports = await this.reportRepo.find({
      where: { reporterId },
      relations: { evidences: true, decisions: true },
      order: { submittedAt: 'DESC' },
    });

    return Promise.all(
      reports.map(async (r) => {
        const reported = await this.getUserSnapshot(r.targetUserId);
        return {
          ...r,
          reportedUserName: reported.name,
          reportedUserAvatar: reported.avatar,
        };
      }),
    );
  }

  async getReports(status?: string | ReportStatus, page = 1, limit = 20) {
    const take = Math.max(1, Math.min(50, limit));
    const skip = (Math.max(1, page) - 1) * take;

    const where: any = {};
    if (status) {
      const s = String(status).toUpperCase().trim();
      if (s === 'PENDING' || s === 'OPEN') {
        where.status = ReportStatus.OPEN;
      } else if (s === 'INVESTIGATING' || s === 'UNDER_REVIEW') {
        where.status = ReportStatus.UNDER_REVIEW;
      } else if (s === 'RESOLVED') {
        where.status = ReportStatus.RESOLVED;
      } else if (s === 'DISMISSED' || s === 'REJECTED') {
        where.status = ReportStatus.REJECTED;
      }
    }

    const [reports, total] = await this.reportRepo.findAndCount({
      where,
      relations: { evidences: true, decisions: true },
      order: { submittedAt: 'DESC' },
      take,
      skip,
    });

    const enrichedReports = await Promise.all(
      reports.map(async (r) => {
        const [reporter, reported] = await Promise.all([
          this.getUserSnapshot(r.reporterId),
          this.getUserSnapshot(r.targetUserId),
        ]);

        const statusMap: Record<string, string> = {
          OPEN: 'PENDING',
          UNDER_REVIEW: 'INVESTIGATING',
          RESOLVED: 'RESOLVED',
          REJECTED: 'DISMISSED',
        };

        const latestDecision =
          r.decisions && r.decisions.length > 0
            ? r.decisions[r.decisions.length - 1]
            : undefined;

        return {
          ...r,
          reporterName: reporter.name,
          reporterAvatar: reporter.avatar,
          reportedUserId: r.targetUserId,
          reportedUserName: reported.name,
          reportedUserAvatar: reported.avatar,
          status: statusMap[r.status] || r.status,
          rawStatus: r.status,
          createdAt: r.submittedAt instanceof Date ? r.submittedAt.toISOString() : r.submittedAt,
          updatedAt: (r.closedAt || r.submittedAt) instanceof Date ? (r.closedAt || r.submittedAt).toISOString() : (r.closedAt || r.submittedAt),
          decision: latestDecision
            ? {
                id: latestDecision.id,
                moderatorId: latestDecision.moderatorId,
                decisionType: latestDecision.decision,
                adminNotes: latestDecision.reason,
                trustScoreDelta: latestDecision.trustDelta,
                createdAt: latestDecision.decidedAt instanceof Date ? latestDecision.decidedAt.toISOString() : latestDecision.decidedAt,
              }
            : undefined,
        };
      }),
    );

    return {
      reports: enrichedReports,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async resolveReport(moderatorId: string, dto: ResolveReportDto) {
    const report = await this.reportRepo.findOne({
      where: { id: dto.reportId },
    });

    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo vi phạm');
    }

    let mappedDecision: ModerationDecisionType = ModerationDecisionType.WARN;
    const rawDecision = String(dto.decisionType || dto.decision || '').toUpperCase();
    if (rawDecision === 'WARNING' || rawDecision === 'WARN') {
      mappedDecision = ModerationDecisionType.WARN;
    } else if (
      rawDecision === 'DEDUCT_TRUST_SCORE' ||
      rawDecision === 'DEDUCT_TRUST' ||
      rawDecision === 'DEDUCT_CREDIT'
    ) {
      mappedDecision = ModerationDecisionType.DEDUCT_TRUST;
    } else if (
      rawDecision === 'SUSPEND_TEMPORARY' ||
      rawDecision === 'BAN_PERMANENT' ||
      rawDecision === 'LOCK_ACCOUNT'
    ) {
      mappedDecision = ModerationDecisionType.LOCK_ACCOUNT;
    } else if (rawDecision === 'DISMISS' || rawDecision === 'NO_ACTION') {
      mappedDecision = ModerationDecisionType.NO_ACTION;
    } else if (rawDecision === 'REMOVE_CONTENT') {
      mappedDecision = ModerationDecisionType.REMOVE_CONTENT;
    }

    const noteText = dto.note?.trim() || dto.adminNotes?.trim() || undefined;

    const decision = this.decisionRepo.create({
      reportId: dto.reportId,
      moderatorId,
      decision: mappedDecision,
      reason: noteText,
      trustDelta: dto.trustScorePenalty ? -dto.trustScorePenalty : 0,
    });
    await this.decisionRepo.save(decision);

    // Apply trust penalty if specified
    if (dto.trustScorePenalty && dto.trustScorePenalty > 0) {
      if (dto.targetRole === 'ALL') {
        await this.changeTrustScore(
          report.targetUserId,
          -dto.trustScorePenalty,
          TrustChangeReason.ADMIN_ADJUSTMENT,
          report.id,
          'VIOLATION_REPORT',
          'MENTOR',
        );
        await this.changeTrustScore(
          report.targetUserId,
          -dto.trustScorePenalty,
          TrustChangeReason.ADMIN_ADJUSTMENT,
          report.id,
          'VIOLATION_REPORT',
          'LEARNER',
        );
      } else {
        const penaltyRole = dto.targetRole === 'LEARNER' ? 'LEARNER' : 'MENTOR';
        await this.changeTrustScore(
          report.targetUserId,
          -dto.trustScorePenalty,
          TrustChangeReason.ADMIN_ADJUSTMENT,
          report.id,
          'VIOLATION_REPORT',
          penaltyRole,
        );
      }
    }

    report.status =
      mappedDecision === ModerationDecisionType.NO_ACTION
        ? ReportStatus.REJECTED
        : ReportStatus.RESOLVED;
    report.closedAt = new Date();
    await this.reportRepo.save(report);

    // 1. Gửi thông báo đến người đã gửi báo cáo (Reporter)
    if (report.reporterId) {
      let reporterMessage = `Báo cáo vi phạm của bạn (#${report.id.substring(0, 8)}) đã được Ban quản trị xem xét và xử lý hoàn tất.`;
      if (mappedDecision === ModerationDecisionType.NO_ACTION) {
        reporterMessage = `Báo cáo vi phạm của bạn (#${report.id.substring(0, 8)}) đã được xem xét. Kết quả: Không phát hiện vi phạm quy chuẩn cộng đồng.${noteText ? ` Ghi chú: ${noteText}` : ''}`;
      } else if (mappedDecision === ModerationDecisionType.WARN) {
        reporterMessage = `Báo cáo vi phạm (#${report.id.substring(0, 8)}) của bạn đã được tiếp nhận và xử lý. Thành viên vi phạm đã bị nhắc nhở/cảnh cáo nghiêm khắc.`;
      } else if (mappedDecision === ModerationDecisionType.DEDUCT_TRUST) {
        reporterMessage = `Báo cáo vi phạm (#${report.id.substring(0, 8)}) của bạn đã được giải quyết. Thành viên vi phạm đã bị xử phạt trừ ${dto.trustScorePenalty || 0} điểm uy tín.`;
      } else if (mappedDecision === ModerationDecisionType.LOCK_ACCOUNT) {
        reporterMessage = `Báo cáo vi phạm (#${report.id.substring(0, 8)}) của bạn đã được giải quyết. Tài khoản vi phạm đã bị áp dụng biện pháp đình chỉ hoạt động.`;
      }

      this.rmqClient.emit(NOTIFICATION_EVENTS.CREATE, {
        userId: report.reporterId,
        title: 'Kết quả xử lý báo cáo vi phạm 🛡️',
        content: reporterMessage,
        type: 'MODERATION',
        referenceId: report.id,
      });
    }

    // 2. Gửi thông báo đến người bị tố cáo (Target User)
    if (report.targetUserId) {
      let targetMessage = `Ban quản trị đã xem xét sự việc liên quan đến tài khoản của bạn.`;
      if (mappedDecision === ModerationDecisionType.NO_ACTION) {
        targetMessage = `Khiếu nại đối với tài khoản của bạn (mã #${report.id.substring(0, 8)}) đã được Ban quản trị xem xét và bác bỏ do không phát hiện vi phạm.`;
      } else if (mappedDecision === ModerationDecisionType.WARN) {
        targetMessage = `Bạn vừa nhận được cảnh cáo nhắc nhở từ Ban quản trị về hành vi vi phạm quy chuẩn cộng đồng.${noteText ? ` Ghi chú: ${noteText}` : ''}`;
      } else if (mappedDecision === ModerationDecisionType.DEDUCT_TRUST) {
        targetMessage = `Bạn bị trừ ${dto.trustScorePenalty || 0} điểm uy tín do vi phạm quy chuẩn cộng đồng.${noteText ? ` Lý do: ${noteText}` : ''}`;
      } else if (mappedDecision === ModerationDecisionType.LOCK_ACCOUNT) {
        targetMessage = `Tài khoản của bạn đã bị áp dụng biện pháp chế tài/khóa tài khoản do vi phạm nghiêm trọng quy chuẩn cộng đồng.${noteText ? ` Lý do: ${noteText}` : ''}`;
      }

      this.rmqClient.emit(NOTIFICATION_EVENTS.CREATE, {
        userId: report.targetUserId,
        title: 'Thông báo xử lý vi phạm từ Quản trị viên ⚠️',
        content: targetMessage,
        type: 'MODERATION',
        referenceId: report.id,
      });
    }

    this.rmqClient.emit(MODERATION_EVENTS.REPORT_RESOLVED, {
      reportId: report.id,
      moderatorId,
      decisionType: rawDecision,
    });

    return report;
  }

  // ==================== LEADERBOARD (BẢNG XẾP HẠNG THI ĐUA) ====================

  /**
   * Tính toán khoảng thời gian bắt đầu và kết thúc theo bộ lọc: tháng, quý, năm, toàn thời gian và kỳ chỉ định (period)
   */
  private getTimeframeDateRange(timeframe: string, period?: string): { startDate?: Date; endDate?: Date } {
    const now = new Date();

    // 1. Theo Tháng (hỗ trợ period = 'YYYY-MM')
    if (timeframe === 'month' || timeframe === 'monthly') {
      let year = now.getFullYear();
      let month = now.getMonth();

      if (period) {
        const parts = period.split('-');
        if (parts.length === 2) {
          const parsedYear = parseInt(parts[0], 10);
          const parsedMonth = parseInt(parts[1], 10) - 1;
          if (!isNaN(parsedYear) && !isNaN(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11) {
            year = parsedYear;
            month = parsedMonth;
          }
        }
      }

      const startDate = new Date(year, month, 1, 0, 0, 0, 0);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { startDate, endDate };
    }

    // 2. Theo Quý (hỗ trợ period = 'YYYY-Q1' .. 'YYYY-Q4')
    if (timeframe === 'quarter') {
      let year = now.getFullYear();
      let quarter = Math.floor(now.getMonth() / 3) + 1;

      if (period) {
        const parts = period.toUpperCase().split('-');
        if (parts.length === 2) {
          const parsedYear = parseInt(parts[0], 10);
          const qMatch = parts[1].replace('Q', '');
          const parsedQ = parseInt(qMatch, 10);
          if (!isNaN(parsedYear) && !isNaN(parsedQ) && parsedQ >= 1 && parsedQ <= 4) {
            year = parsedYear;
            quarter = parsedQ;
          }
        }
      }

      const startMonth = (quarter - 1) * 3;
      const startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
      const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
      return { startDate, endDate };
    }

    // 3. Theo Năm (hỗ trợ period = 'YYYY')
    if (timeframe === 'year') {
      let year = now.getFullYear();

      if (period) {
        const parsedYear = parseInt(period, 10);
        if (!isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) {
          year = parsedYear;
        }
      }

      const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      return { startDate, endDate };
    }

    // 4. Toàn thời gian
    return {};
  }

  /**
   * Lấy Bảng Xếp Hạng Top Người Dạy Tiêu Biểu (Mentor Leaderboard)
   */
  async getMentorLeaderboard(timeframe = 'all', period?: string, limit = 20) {
    const { startDate, endDate } = this.getTimeframeDateRange(timeframe, period);

    // 1. Lấy thông tin review & rating của tất cả mentors theo khung thời gian
    let ratingsQb = this.ratingRepo
      .createQueryBuilder('r')
      .select('r.mentorId', 'mentorId')
      .addSelect('AVG(r.stars)', 'avgStars')
      .addSelect('COUNT(r.id)', 'totalReviews')
      .addSelect('COUNT(CASE WHEN r.stars = 5 THEN 1 END)', 'fiveStarCount');

    if (startDate && endDate) {
      ratingsQb = ratingsQb.where('r.submittedAt >= :startDate AND r.submittedAt <= :endDate', {
        startDate,
        endDate,
      });
    }

    const ratings = await ratingsQb.groupBy('r.mentorId').getRawMany();

    const ratingMap = new Map<string, { avgStars: number; totalReviews: number; fiveStarCount: number }>();
    for (const r of ratings) {
      if (r.mentorId) {
        ratingMap.set(r.mentorId, {
          avgStars: Number(Number(r.avgStars || 0).toFixed(1)),
          totalReviews: Number(r.totalReviews || 0),
          fiveStarCount: Number(r.fiveStarCount || 0),
        });
      }
    }

    // 2. Lấy danh sách profiles từ User Service
    let profiles: any[] = [];
    try {
      const userUrl = process.env.USER_SERVICE_URL || 'http://user:3002';
      const res = await fetch(`${userUrl}/users?limit=100`);
      if (res.ok) {
        const data = await res.json();
        profiles = data.users || [];
      }
    } catch (err) {
      this.logger.debug('Could not fetch user profiles for mentor leaderboard:', err);
    }

    // 3. Tính điểm MentorRankScore theo công thức:
    // (Stars * 200) + (TeachingMinutes * 0.5) + (StudentsTaught * 10) + (5StarReviews * 15)
    const items = profiles.map((p) => {
      const r = ratingMap.get(p.userId) || { avgStars: 0, totalReviews: 0, fiveStarCount: 0 };
      const teachingMins = Math.max(
        Number(p.totalTeachingMinutes || 0),
        Number((r.totalReviews || 0) * 60),
      );
      const studentsTaught = Math.max(
        Number(p.totalSessionsCompleted || 0),
        Number(r.totalReviews || 0),
      );
      
      const starScore = r.totalReviews > 0 ? (r.avgStars * 200) : 0;
      const rankScore = Math.round(
        starScore + (teachingMins * 0.5) + (studentsTaught * 10) + (r.fiveStarCount * 15),
      );

      return {
        userId: p.userId,
        name: p.displayName || p.fullName || 'Người Dạy',
        avatar: p.avatarUrl || '',
        headline: p.bio || 'Chuyên gia hướng dẫn tận tâm',
        mentorTrustScore: p.mentorTrustScore ?? p.trustScore ?? 100,
        averageRating: r.avgStars,
        totalReviews: r.totalReviews,
        totalTeachingMinutes: teachingMins,
        totalStudentsTaught: studentsTaught,
        fiveStarReviewsCount: r.fiveStarCount,
        rankScore,
      };
    });

    items.sort((a, b) => b.rankScore - a.rankScore);

    const rankedItems = items.slice(0, limit).map((item, index) => ({
      ...item,
      rank: index + 1,
      badgeTitle: index === 0 ? 'Master Mentor 👑' : index < 3 ? 'Top Expert ⭐' : index < 10 ? 'Senior Mentor 🌟' : 'Active Mentor',
    }));

    return {
      timeframe,
      period,
      items: rankedItems,
      total: rankedItems.length,
    };
  }

  /**
   * Lấy Bảng Xếp Hạng Top Học Viên Tích Cực (Learner Leaderboard)
   */
  async getLearnerLeaderboard(timeframe = 'all', period?: string, limit = 20) {
    const { startDate, endDate } = this.getTimeframeDateRange(timeframe, period);

    let profiles: any[] = [];
    try {
      const userUrl = process.env.USER_SERVICE_URL || 'http://user:3002';
      const res = await fetch(`${userUrl}/users?limit=100`);
      if (res.ok) {
        const data = await res.json();
        profiles = data.users || [];
      }
    } catch (err) {
      this.logger.debug('Could not fetch user profiles for learner leaderboard:', err);
    }

    // Đếm số lượng review đã đóng góp theo khung thời gian
    let reviewQb = this.ratingRepo
      .createQueryBuilder('r')
      .select('r.learnerId', 'learnerId')
      .addSelect('COUNT(r.id)', 'count');

    if (startDate && endDate) {
      reviewQb = reviewQb.where('r.submittedAt >= :startDate AND r.submittedAt <= :endDate', {
        startDate,
        endDate,
      });
    }

    const reviewCounts = await reviewQb.groupBy('r.learnerId').getRawMany();

    const reviewMap = new Map<string, number>();
    for (const rc of reviewCounts) {
      if (rc.learnerId) {
        reviewMap.set(rc.learnerId, Number(rc.count || 0));
      }
    }

    // Tính điểm LearnerRankScore theo công thức MỚI (Đã loại bỏ tiêu chí Kỹ Năng Mới):
    // (LearningMinutes * 1.0) + (SessionsCompleted * 25) + (ReviewsSubmitted * 15)
    const items = profiles.map((p) => {
      const reviewsCount = reviewMap.get(p.userId) || 0;
      const sessions = Math.max(
        Number(p.totalSessionsCompleted || 0),
        Number(reviewsCount || 0),
      );
      const learningMins = Math.max(
        Number(p.totalLearningMinutes || 0),
        Number(sessions * 60),
      );

      const rankScore = Math.round(
        (learningMins * 1.0) + (sessions * 25) + (reviewsCount * 15),
      );

      return {
        userId: p.userId,
        name: p.displayName || p.fullName || 'Học Viên',
        avatar: p.avatarUrl || '',
        headline: p.bio || 'Học viên tích cực phát triển kỹ năng',
        learnerTrustScore: p.learnerTrustScore ?? 100,
        totalLearningMinutes: learningMins,
        totalSessionsCompleted: sessions,
        reviewsSubmittedCount: reviewsCount,
        rankScore,
      };
    });

    items.sort((a, b) => b.rankScore - a.rankScore);

    const rankedItems = items.slice(0, limit).map((item, index) => ({
      ...item,
      rank: index + 1,
      badgeTitle: index === 0 ? 'Học Giả Xuất Chúng 👑' : index < 3 ? 'Ong Chăm Chỉ ⭐' : index < 10 ? 'Nhà Khám Phá 🌟' : 'Học Viên Tiên Phong',
    }));

    return {
      timeframe,
      period,
      items: rankedItems,
      total: rankedItems.length,
    };
  }
}
