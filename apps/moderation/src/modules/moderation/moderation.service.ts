import { Injectable, Logger, BadRequestException, NotFoundException, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
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
  ) { }

  async onModuleInit() {
    try {
      await this.trustScoreChangeRepo.query(`
        ALTER TABLE IF EXISTS "trust_score_change"
        DROP CONSTRAINT IF EXISTS "FK_8182546d64c6aad26aa3b544ce7";
      `);
      this.logger.log('Legacy FK constraint on trust_score_change removed successfully');
    } catch (err: any) {
      this.logger.debug('FK cleanup query result:', err.message);
    }
  }

  // ==================== RATINGS & REVIEWS ====================

  private async getUserSnapshot(userId: string): Promise<{ name: string; avatar: string }> {
    try {
      const userUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
      const res = await fetch(`${userUrl}/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        return {
          name: data.displayName || data.fullName || data.name || 'Học viên',
          avatar: data.avatarUrl || data.avatar || '',
        };
      }
    } catch (err) {
      this.logger.debug(`Could not fetch user snapshot for ${userId}:`, err);
    }
    return { name: 'Học viên', avatar: '' };
  }

  async createRating(reviewerId: string, dto: CreateRatingDto) {
    const stars = Math.max(1, Math.min(5, Math.round(dto.stars)));
    const targetUserId = dto.mentorId || dto.learnerId;

    let reviewerName = dto.reviewerName?.trim();
    let reviewerAvatar = dto.reviewerAvatar?.trim();

    if (!reviewerName || reviewerName === 'Học viên' || reviewerName === 'Học viên UniTime') {
      const snapshot = await this.getUserSnapshot(reviewerId);
      reviewerName = snapshot.name;
      reviewerAvatar = snapshot.avatar || reviewerAvatar;
    }

    // Check if rating for this booking already exists
    const existing = await this.ratingRepo.findOne({
      where: { bookingId: dto.bookingId, learnerId: reviewerId },
    });

    let savedRating: PostSessionRating;

    if (existing) {
      // Upsert: Cập nhật đánh giá cũ
      const oldStars = existing.stars;
      existing.stars = stars;
      existing.comment = dto.comment?.trim() || undefined;
      existing.reviewerName = reviewerName || existing.reviewerName;
      existing.reviewerAvatar = reviewerAvatar || existing.reviewerAvatar;
      existing.submittedAt = new Date();
      savedRating = await this.ratingRepo.save(existing);

      // Tính toán chênh lệch Trust Score giữa số sao mới và cũ
      const starDeltaMap: Record<number, number> = { 1: -2, 2: -1, 3: 0, 4: 1, 5: 2 };
      const netDelta = (starDeltaMap[stars] || 0) - (starDeltaMap[oldStars] || 0);

      if (netDelta !== 0 && targetUserId) {
        await this.changeTrustScore(
          targetUserId,
          netDelta,
          stars >= 4 ? TrustChangeReason.RATING_5_STAR : TrustChangeReason.RATING_2_STAR,
          savedRating.id,
          'POST_SESSION_RATING',
        );
      }
    } else {
      // Tạo đánh giá mới
      const rating = this.ratingRepo.create({
        bookingId: dto.bookingId,
        sessionId: dto.sessionId || dto.bookingId,
        learnerId: reviewerId,
        mentorId: targetUserId,
        stars,
        comment: dto.comment?.trim() || undefined,
        reviewerName,
        reviewerAvatar,
      });

      savedRating = await this.ratingRepo.save(rating);

      // Calculate Trust Score Delta for Mentor
      let delta = 0;
      let reason = TrustChangeReason.SESSION_COMPLETED;
      if (stars === 5) {
        delta = 2;
        reason = TrustChangeReason.RATING_5_STAR;
      } else if (stars === 4) {
        delta = 1;
        reason = TrustChangeReason.RATING_4_STAR;
      } else if (stars === 2) {
        delta = -1;
        reason = TrustChangeReason.RATING_2_STAR;
      } else if (stars === 1) {
        delta = -2;
        reason = TrustChangeReason.RATING_1_STAR;
      }

      if (delta !== 0 && targetUserId) {
        await this.changeTrustScore(
          targetUserId,
          delta,
          reason,
          savedRating.id,
          'POST_SESSION_RATING',
        );
      }
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

    // Enrich reviewer info for reviews (especially legacy/older ones missing reviewerName)
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

  // ==================== TRUST SCORE ====================

  async getOrCreateTrustScore(userId: string): Promise<TrustScore> {
    let ts = await this.trustScoreRepo.findOne({ where: { userId } });
    if (!ts) {
      ts = this.trustScoreRepo.create({
        userId,
        score: 100,
        tier: TrustTier.GOOD,
      });
      ts = await this.trustScoreRepo.save(ts);
    }
    return ts;
  }

  private calculateTier(score: number): TrustTier {
    if (score >= 120) return TrustTier.EXCELLENT;
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
  ) {
    const ts = await this.getOrCreateTrustScore(userId);
    const scoreBefore = ts.score;
    const scoreAfter = Math.max(0, Math.min(200, scoreBefore + delta));
    const tier = this.calculateTier(scoreAfter);

    ts.score = scoreAfter;
    ts.tier = tier;
    ts.lastUpdatedAt = new Date();
    await this.trustScoreRepo.save(ts);

    // Save change log
    const change = this.trustScoreChangeRepo.create({
      userId,
      trustScore: ts,
      delta,
      reason,
      scoreBefore,
      scoreAfter,
      sourceEventId,
      sourceEventKind,
    });
    await this.trustScoreChangeRepo.save(change);

    this.logger.log(`Trust score updated for user ${userId}: ${scoreBefore} -> ${scoreAfter} (${delta > 0 ? '+' : ''}${delta})`);

    // Emit event
    this.rmqClient.emit(MODERATION_EVENTS.TRUST_SCORE_UPDATED, {
      userId,
      score: scoreAfter,
      delta,
      reason,
      tier,
    });

    return ts;
  }

  async getTrustScore(userId: string) {
    return this.getOrCreateTrustScore(userId);
  }

  async getTrustScoreHistory(userId: string) {
    const trustScore = await this.getOrCreateTrustScore(userId);
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

  // ==================== VIOLATION REPORTS ====================

  async createReport(reporterId: string, dto: CreateViolationReportDto) {
    const report = this.reportRepo.create({
      reporterId,
      targetUserId: dto.targetUserId,
      targetType: (dto.targetType as ReportTargetType) || ReportTargetType.USER,
      targetId: dto.targetId || dto.targetUserId,
      category: (dto.category as ReportCategory) || ReportCategory.OTHER,
      description: dto.description?.trim() || undefined,
      status: ReportStatus.OPEN,
    });

    const savedReport = await this.reportRepo.save(report);

    if (dto.evidenceUrls && dto.evidenceUrls.length > 0) {
      const evidences = dto.evidenceUrls.map((ev) =>
        this.evidenceRepo.create({
          reportId: savedReport.id,
          fileUrl: ev.url,
          kind: (ev.kind as EvidenceKind) || EvidenceKind.IMAGE,
        }),
      );
      await this.evidenceRepo.save(evidences);
    }

    this.rmqClient.emit(MODERATION_EVENTS.REPORT_CREATED, {
      reportId: savedReport.id,
      reporterId: savedReport.reporterId,
      targetUserId: savedReport.targetUserId,
      category: savedReport.category,
    });

    return this.reportRepo.findOne({
      where: { id: savedReport.id },
      relations: { evidences: true },
    });
  }

  async getMyReports(reporterId: string) {
    return this.reportRepo.find({
      where: { reporterId },
      relations: { evidences: true, decisions: true },
      order: { submittedAt: 'DESC' },
    });
  }

  async getReports(status?: ReportStatus, page = 1, limit = 20) {
    const take = Math.max(1, Math.min(50, limit));
    const skip = (Math.max(1, page) - 1) * take;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [reports, total] = await this.reportRepo.findAndCount({
      where,
      relations: { evidences: true, decisions: true },
      order: { submittedAt: 'DESC' },
      take,
      skip,
    });

    return {
      reports,
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

    const decision = this.decisionRepo.create({
      reportId: dto.reportId,
      moderatorId,
      decision: (dto.decisionType as ModerationDecisionType) || ModerationDecisionType.WARN,
      reason: dto.note || undefined,
      trustDelta: dto.trustScorePenalty ? -dto.trustScorePenalty : 0,
    });
    await this.decisionRepo.save(decision);

    // Apply trust penalty if specified
    if (dto.trustScorePenalty && dto.trustScorePenalty > 0) {
      await this.changeTrustScore(
        report.targetUserId,
        -dto.trustScorePenalty,
        TrustChangeReason.ADMIN_ADJUSTMENT,
        report.id,
        'VIOLATION_REPORT',
      );
    }

    report.status = ReportStatus.RESOLVED;
    report.closedAt = new Date();
    await this.reportRepo.save(report);

    this.rmqClient.emit(MODERATION_EVENTS.REPORT_RESOLVED, {
      reportId: report.id,
      moderatorId,
      decisionType: dto.decisionType,
    });

    return report;
  }
}
