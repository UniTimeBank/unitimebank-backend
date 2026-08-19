import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { Booking } from './modules/booking/entities/booking.entity';
import {
  CreateMentorPostBookingDto,
  CreateLearnerRequestBookingDto,
  RespondBookingDto,
  GetBookingsQueryDto,
  BookingOrigin,
  BookingStatus,
} from '@app/contracts/booking';

@Injectable()
export class BookingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingService.name);
  private expirationInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @Inject('POST_SERVICE') private readonly postClient: ClientProxy,
    @Inject('WALLET_SERVICE') private readonly walletClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
  ) {}

  async onModuleInit() {
    this.logger.log('BookingService initialized. Running initial pending bookings expiration check...');
    await this.checkAndExpirePendingBookings();

    // Định kỳ quét các yêu cầu quá hạn mỗi 1 phút
    this.expirationInterval = setInterval(() => {
      this.checkAndExpirePendingBookings().catch((err) => {
        this.logger.error('Error during scheduled checkAndExpirePendingBookings sweep:', err);
      });
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.expirationInterval) {
      clearInterval(this.expirationInterval);
      this.expirationInterval = null;
    }
  }

  /**
   * Tự động quét & chuyển trạng thái EXPIRED + hoàn tiền ký quỹ cho các yêu cầu quá hạn 24h hoặc quá giờ bắt đầu
   */
  async checkAndExpirePendingBookings(specificBookingId?: string): Promise<number> {
    try {
      const qb = this.bookingRepo.createQueryBuilder('booking')
        .where('booking.status IN (:...pendingStatuses)', {
          pendingStatuses: [
            BookingStatus.PENDING_MENTOR_APPROVAL,
            BookingStatus.PENDING_LEARNER_APPROVAL,
          ],
        });

      if (specificBookingId) {
        qb.andWhere('booking.id = :specificBookingId', { specificBookingId });
      }

      const pendingList = await qb.getMany();
      if (!pendingList.length) return 0;

      let expiredCount = 0;
      const now = Date.now();
      const EXPIRATION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 giờ

      for (const booking of pendingList) {
        const createdAtMs = new Date(booking.createdAt).getTime();
        const scheduledStartMs = new Date(booking.scheduledStart).getTime();
        const is24hExpired = now - createdAtMs >= EXPIRATION_DURATION_MS;
        const isStartPassed = now >= scheduledStartMs;

        if (is24hExpired || isStartPassed) {
          const reason = isStartPassed
            ? 'Yêu cầu đã quá giờ bắt đầu buổi học mà chưa được phản hồi'
            : 'Yêu cầu đặt lịch đã hết hạn sau 24 giờ không có phản hồi';

          this.logger.warn(`Auto-expiring booking ${booking.id} (Created at: ${booking.createdAt}, Reason: ${reason})`);

          // 1. Hoàn trả 100% tiền ký quỹ cho Learner nếu origin là MENTOR_POST
          let creditRefunded = false;
          if (booking.origin === BookingOrigin.MENTOR_POST && booking.totalCreditEscrowed > 0) {
            try {
              await firstValueFrom(
                this.walletClient
                  .send('wallet.refundEscrow', {
                    bookingId: booking.id,
                    learnerId: booking.learnerId,
                    amount: booking.totalCreditEscrowed,
                    reason: `Hoàn tiền: ${reason}`,
                  })
                  .pipe(timeout(7000)),
              );
              creditRefunded = true;
              this.logger.log(`Successfully refunded ${booking.totalCreditEscrowed} credits to learner ${booking.learnerId} for expired booking ${booking.id}`);
            } catch (refundErr) {
              this.logger.error(`Failed to refund escrow for expired booking ${booking.id}:`, refundErr);
            }
          }

          // 2. Cập nhật trạng thái Booking thành EXPIRED
          booking.status = BookingStatus.EXPIRED;
          booking.cancelledAt = new Date();
          booking.cancelledBy = 'SYSTEM';
          booking.cancellationReason = reason;
          await this.bookingRepo.save(booking);
          expiredCount++;

          // 3. Gửi thông báo cho Học viên
          try {
            this.notificationClient.emit('notification.create', {
              userId: booking.learnerId,
              title: 'Yêu cầu đặt lịch đã hết hạn',
              content: `Yêu cầu đặt lịch "${booking.title || 'Buổi học'}" đã hết hạn sau 24 giờ không có phản hồi.${creditRefunded ? ` ${booking.totalCreditEscrowed} Credit đã được tự động hoàn lại vào ví khả dụng của bạn.` : ''}`,
              type: 'BOOKING_CANCELLED',
              referenceId: booking.id,
            });
          } catch (notifErr) {
            this.logger.warn('Failed to emit learner notification for expired booking:', notifErr);
          }

          // 4. Gửi thông báo cho Mentor
          try {
            this.notificationClient.emit('notification.create', {
              userId: booking.mentorId,
              title: 'Yêu cầu đặt lịch đã hết hạn',
              content: `Yêu cầu đặt lịch "${booking.title || 'Buổi học'}" từ ${booking.learnerName || 'Học viên'} đã hết hạn sau 24 giờ không có phản hồi.`,
              type: 'BOOKING_CANCELLED',
              referenceId: booking.id,
            });
          } catch (notifErr) {
            this.logger.warn('Failed to emit mentor notification for expired booking:', notifErr);
          }
        }
      }

      return expiredCount;
    } catch (err) {
      this.logger.error('Error during checkAndExpirePendingBookings:', err);
      return 0;
    }
  }

  /**
   * Helper: Lấy thông tin họ tên & Avatar thực của user từ User Service
   */
  private async getUserSnapshot(userId: string): Promise<{ name: string; avatar: string }> {
    try {
      const userUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
      const res = await fetch(`${userUrl}/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        return {
          name: data.displayName || data.fullName || 'Thành viên',
          avatar: data.avatarUrl || '',
        };
      }
    } catch (err) {
      this.logger.warn(`Could not fetch user snapshot for ${userId}: ${err}`);
    }
    return { name: 'Thành viên', avatar: '' };
  }

  /**
   * Learner gửi yêu cầu Đặt lịch trên bài đăng của Mentor
   */
  async requestMentorPost(
    learnerId: string,
    dto: CreateMentorPostBookingDto,
    learnerSnapshot?: { name?: string; avatar?: string },
  ): Promise<Booking> {
    // 1. Lấy thông tin bài đăng Mentor
    let mentorPost: any;
    try {
      mentorPost = await firstValueFrom(
        this.postClient.send('post.mentor.findOne', { id: dto.mentorPostId }).pipe(timeout(5000)),
      );
    } catch (err) {
      this.logger.error(`Failed to fetch mentor post ${dto.mentorPostId}:`, err);
      throw new NotFoundException('Bài đăng của Mentor không tồn tại hoặc đã bị gỡ');
    }

    if (!mentorPost) {
      throw new NotFoundException('Bài đăng của Mentor không tồn tại');
    }

    if (mentorPost.mentorId === learnerId) {
      throw new BadRequestException('Bạn không thể tự đặt lịch học với chính mình');
    }

    // Kiểm tra chống spam: Không cho phép đặt lịch nhiều lần cho cùng 1 bài đăng nếu đã có yêu cầu đang xử lý / đã xác nhận
    const existingActiveBooking = await this.bookingRepo.findOne({
      where: {
        sourcePostId: dto.mentorPostId,
        learnerId: learnerId,
        status: In([
          BookingStatus.PENDING_MENTOR_APPROVAL,
          BookingStatus.CONFIRMED,
          BookingStatus.STARTED,
        ]),
      },
    });

    if (existingActiveBooking) {
      if (existingActiveBooking.status === BookingStatus.PENDING_MENTOR_APPROVAL) {
        throw new BadRequestException('Bạn đã gửi yêu cầu đặt lịch cho bài đăng này và đang chờ gia sư phản hồi');
      }
      throw new BadRequestException('Bạn đã có lịch học đang hoạt động cho bài đăng này');
    }

    // Lấy thông tin profile học viên
    const learnerSnap =
      learnerSnapshot?.name && learnerSnapshot.name !== 'Học viên'
        ? learnerSnapshot
        : await this.getUserSnapshot(learnerId);

    // 2. Tạo bản ghi Booking ở trạng thái CHỜ MENTOR DUYỆT
    const startMs = new Date(dto.scheduledStart).getTime();
    const endMs = new Date(dto.scheduledEnd).getTime();
    const calcMinutes = Math.max(15, Math.round((endMs - startMs) / 60000));
    const duration = dto.durationMinutes || (isNaN(calcMinutes) ? 60 : calcMinutes);

    const booking = this.bookingRepo.create({
      origin: BookingOrigin.MENTOR_POST,
      sourcePostId: dto.mentorPostId,
      mentorId: mentorPost.mentorId,
      mentorName: mentorPost.mentorName || 'Mentor',
      mentorAvatar: mentorPost.mentorAvatar || '',
      learnerId: learnerId,
      learnerName: learnerSnap.name || 'Học viên',
      learnerAvatar: learnerSnap.avatar || '',
      title: mentorPost.title || 'Buổi học 1:1',
      note: dto.note || dto.message || '',
      scheduledStart: new Date(dto.scheduledStart),
      scheduledEnd: new Date(dto.scheduledEnd),
      durationMinutes: duration,
      totalCreditEscrowed: duration, // 1 phút = 1 Credit
      status: BookingStatus.PENDING_MENTOR_APPROVAL,
    });

    const saved = await this.bookingRepo.save(booking);

    // 3. Ký quỹ ngay lập tức số Credit của Học viên vào Escrow
    try {
      await firstValueFrom(
        this.walletClient
          .send('booking.accepted', {
            bookingId: saved.id,
            learnerId: learnerId,
            amount: saved.totalCreditEscrowed,
          })
          .pipe(timeout(7000)),
      );
    } catch (err: any) {
      this.logger.error(`Immediate escrow hold failed for booking ${saved.id}:`, err);
      // Xóa bản ghi booking vừa tạo nếu không đủ credit để ký quỹ
      await this.bookingRepo.delete(saved.id);
      const msg =
        err?.message ||
        err?.data?.message ||
        `Số dư khả dụng không đủ để ký quỹ booking (Cần ${duration} Credit).`;
      throw new BadRequestException(msg);
    }

    // 4. Gửi thông báo cho Mentor
    try {
      this.notificationClient.emit('notification.create', {
        userId: mentorPost.mentorId,
        title: 'Yêu cầu đặt lịch mới',
        content: `${learnerSnap.name || 'Một học viên'} đã gửi yêu cầu học bài "${mentorPost.title}".`,
        type: 'BOOKING_REQUEST',
        referenceId: saved.id,
      });
    } catch (err) {
      this.logger.warn('Failed to emit notification:', err);
    }

    return saved;
  }

  /**
   * Mentor gửi đề nghị dạy trên Yêu cầu học của Learner
   */
  async applyLearnerRequest(
    mentorId: string,
    dto: CreateLearnerRequestBookingDto,
    mentorSnapshot?: { name?: string; avatar?: string },
  ): Promise<Booking> {
    // 1. Lấy thông tin bài Yêu cầu của Learner
    let learnerReq: any;
    try {
      learnerReq = await firstValueFrom(
        this.postClient.send('post.learner.findOne', { id: dto.learnerRequestId }).pipe(timeout(5000)),
      );
    } catch (err) {
      this.logger.error(`Failed to fetch learner request ${dto.learnerRequestId}:`, err);
      throw new NotFoundException('Bài yêu cầu tìm người dạy không tồn tại hoặc đã bị hủy');
    }

    if (!learnerReq) {
      throw new NotFoundException('Bài yêu cầu không tồn tại');
    }

    if (learnerReq.learnerId === mentorId) {
      throw new BadRequestException('Bạn không thể tự gửi đề nghị dạy cho bài yêu cầu của chính mình');
    }

    // Kiểm tra chống spam: Không cho phép gửi đề nghị dạy nhiều lần cho cùng 1 bài yêu cầu nếu đang chờ phản hồi hoặc đã xác nhận
    const existingActiveOffer = await this.bookingRepo.findOne({
      where: {
        sourcePostId: dto.learnerRequestId,
        mentorId: mentorId,
        status: In([
          BookingStatus.PENDING_LEARNER_APPROVAL,
          BookingStatus.CONFIRMED,
          BookingStatus.STARTED,
        ]),
      },
    });

    if (existingActiveOffer) {
      if (existingActiveOffer.status === BookingStatus.PENDING_LEARNER_APPROVAL) {
        throw new BadRequestException('Bạn đã gửi đề nghị dạy cho bài yêu cầu này và đang chờ học viên phản hồi');
      }
      throw new BadRequestException('Bạn đã có lịch học đang hoạt động cho bài yêu cầu này');
    }

    // Lấy thông tin profile người dạy
    const mentorSnap =
      mentorSnapshot?.name && mentorSnapshot.name !== 'Mentor'
        ? mentorSnapshot
        : await this.getUserSnapshot(mentorId);

    // 2. Tạo bản ghi Booking ở trạng thái CHỜ LEARNER DUYỆT
    const startMs = new Date(dto.scheduledStart).getTime();
    const endMs = new Date(dto.scheduledEnd).getTime();
    const calcMinutes = Math.max(15, Math.round((endMs - startMs) / 60000));
    const duration = dto.durationMinutes || learnerReq.expectedDurationMinutes || (isNaN(calcMinutes) ? 60 : calcMinutes);

    const booking = this.bookingRepo.create({
      origin: BookingOrigin.LEARNER_REQUEST,
      sourcePostId: dto.learnerRequestId,
      mentorId: mentorId,
      mentorName: mentorSnap.name || 'Mentor',
      mentorAvatar: mentorSnap.avatar || '',
      learnerId: learnerReq.learnerId,
      learnerName: learnerReq.learnerName || 'Học viên',
      learnerAvatar: learnerReq.learnerAvatar || '',
      title: learnerReq.skillNeeded || 'Hướng dẫn môn học',
      note: dto.note || dto.message || '',
      scheduledStart: new Date(dto.scheduledStart),
      scheduledEnd: new Date(dto.scheduledEnd),
      durationMinutes: duration,
      totalCreditEscrowed: duration,
      status: BookingStatus.PENDING_LEARNER_APPROVAL,
    });

    const saved = await this.bookingRepo.save(booking);

    // 3. Gửi thông báo cho Learner
    try {
      this.notificationClient.emit('notification.create', {
        userId: learnerReq.learnerId,
        title: 'Đề nghị dạy mới từ Mentor',
        content: `Mentor ${mentorSnap.name || ''} đã đề nghị dạy bài yêu cầu "${learnerReq.skillNeeded}" của bạn.`,
        type: 'BOOKING_OFFER',
        referenceId: saved.id,
      });
    } catch (err) {
      this.logger.warn('Failed to emit notification:', err);
    }

    return saved;
  }

  /**
   * Phê duyệt (Xác nhận & Ký quỹ) hoặc Từ chối Booking
   */
  async respondBooking(userId: string, bookingId: string, dto: RespondBookingDto): Promise<Booking> {
    // 0. Quét kiểm tra hết hạn cho booking này
    await this.checkAndExpirePendingBookings(bookingId);

    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy bản ghi đặt lịch');
    }

    if (booking.status === BookingStatus.EXPIRED) {
      throw new BadRequestException('Yêu cầu đặt lịch này đã hết hạn sau 24 giờ không có phản hồi');
    }

    // Kiểm tra quyền duyệt
    if (booking.status === BookingStatus.PENDING_MENTOR_APPROVAL) {
      if (booking.mentorId !== userId) {
        throw new ForbiddenException('Chỉ Mentor của bài dạy này mới có quyền duyệt yêu cầu');
      }
    } else if (booking.status === BookingStatus.PENDING_LEARNER_APPROVAL) {
      if (booking.learnerId !== userId) {
        throw new ForbiddenException('Chỉ Học viên tạo yêu cầu này mới có quyền chấp nhận Mentor');
      }
    } else {
      throw new BadRequestException(`Booking đang ở trạng thái "${booking.status}", không thể duyệt/từ chối nữa`);
    }

    // Trường hợp TỪ CHỐI
    if (dto.action === 'REJECT') {
      // Nếu là booking từ Mentor Post (Học viên đã ký quỹ lúc tạo) -> Hoàn trả credit cho Học viên
      if (booking.origin === BookingOrigin.MENTOR_POST && booking.totalCreditEscrowed > 0) {
        try {
          await firstValueFrom(
            this.walletClient
              .send('wallet.refundEscrow', {
                bookingId: booking.id,
                learnerId: booking.learnerId,
                amount: booking.totalCreditEscrowed,
                reason: dto.reason || 'Gia sư từ chối yêu cầu đặt lịch',
              })
              .pipe(timeout(7000)),
          );
        } catch (err) {
          this.logger.error(`Failed to refund escrow on reject for booking ${booking.id}:`, err);
        }
      }

      booking.status = BookingStatus.REJECTED;
      booking.cancellationReason = dto.reason || 'Bị từ chối bởi người dùng';
      booking.cancelledBy = userId;
      booking.cancelledAt = new Date();
      return this.bookingRepo.save(booking);
    }

    // Trường hợp CHẤP NHẬN
    // 1. Kiểm tra chống trùng lịch (Schedule Conflict Check) cho cả Mentor và Learner
    const start = booking.scheduledStart;
    const end = booking.scheduledEnd;

    // Kiểm tra lịch trùng của Mentor (với tư cách là Mentor hoặc Learner ở buổi học khác đã xác nhận)
    const mentorConflict = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.id != :currentId', { currentId: booking.id })
      .andWhere('b.status IN (:...activeStatuses)', {
        activeStatuses: [BookingStatus.CONFIRMED, BookingStatus.STARTED],
      })
      .andWhere('(b.mentorId = :mentorId OR b.learnerId = :mentorId)', {
        mentorId: booking.mentorId,
      })
      .andWhere('b.scheduledStart < :end AND b.scheduledEnd > :start', { start, end })
      .getOne();

    if (mentorConflict) {
      const isSelf = userId === booking.mentorId;
      throw new BadRequestException(
        isSelf
          ? `Bạn đã có một lịch học khác ("${mentorConflict.title}") trong khung giờ này`
          : `Gia sư đã có một lịch học khác trong khung giờ này, không thể xác nhận`,
      );
    }

    // Kiểm tra lịch trùng của Learner (với tư cách là Learner hoặc Mentor ở buổi học khác đã xác nhận)
    const learnerConflict = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.id != :currentId', { currentId: booking.id })
      .andWhere('b.status IN (:...activeStatuses)', {
        activeStatuses: [BookingStatus.CONFIRMED, BookingStatus.STARTED],
      })
      .andWhere('(b.mentorId = :learnerId OR b.learnerId = :learnerId)', {
        learnerId: booking.learnerId,
      })
      .andWhere('b.scheduledStart < :end AND b.scheduledEnd > :start', { start, end })
      .getOne();

    if (learnerConflict) {
      const isSelf = userId === booking.learnerId;
      throw new BadRequestException(
        isSelf
          ? `Bạn đã có một lịch học khác ("${learnerConflict.title}") trong khung giờ này`
          : `Học viên đã có một lịch học khác trong khung giờ này, không thể xác nhận`,
      );
    }

    // 2. Ký quỹ Credit nếu là Học viên duyệt đề nghị của Mentor (Luồng Learner Request)
    // (Lưu ý: Luồng Mentor Post đã ký quỹ ngay từ lúc Học viên gửi yêu cầu)
    if (booking.status === BookingStatus.PENDING_LEARNER_APPROVAL) {
      try {
        await firstValueFrom(
          this.walletClient
            .send('booking.accepted', {
              bookingId: booking.id,
              learnerId: booking.learnerId,
              amount: booking.totalCreditEscrowed,
            })
            .pipe(timeout(7000)),
        );
      } catch (err: any) {
        this.logger.error(`Escrow hold failed for booking ${booking.id}:`, err);
        const msg = err?.message || err?.data?.message || 'Học viên không đủ số dư Credit để thực hiện ký quỹ';
        throw new BadRequestException(msg);
      }
    }

    // Cập nhật trạng thái Booking thành CONFIRMED (Đã xác nhận thành công)
    booking.status = BookingStatus.CONFIRMED;
    booking.acceptedAt = new Date();
    const saved = await this.bookingRepo.save(booking);

    // Thông báo cho phía còn lại
    const targetUserId = userId === booking.mentorId ? booking.learnerId : booking.mentorId;
    try {
      this.notificationClient.emit('notification.create', {
        userId: targetUserId,
        title: 'Lịch học đã được xác nhận!',
        content: `Buổi học "${booking.title}" đã được xác nhận thành công và ký quỹ Credit.`,
        type: 'BOOKING_CONFIRMED',
        referenceId: saved.id,
      });
    } catch (err) {
      this.logger.warn('Failed to emit notification:', err);
    }

    return saved;
  }

  /**
   * Lấy danh sách booking của user (Vai trò Learner hoặc Mentor)
   */
  async getMyBookings(userId: string, query: GetBookingsQueryDto) {
    // 0. Quét kiểm tra và hết hạn realtime các booking quá hạn
    await this.checkAndExpirePendingBookings();

    const qb = this.bookingRepo.createQueryBuilder('booking');

    if (query.role === 'AS_LEARNER') {
      qb.where('booking.learnerId = :userId', { userId });
    } else if (query.role === 'AS_MENTOR') {
      qb.where('booking.mentorId = :userId', { userId });
    } else {
      qb.where('(booking.learnerId = :userId OR booking.mentorId = :userId)', { userId });
    }

    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }

    qb.orderBy('booking.createdAt', 'DESC');

    const [items, total] = await qb.getManyAndCount();

    // Enrich real profile names & avatars for existing records
    const enrichedItems = await Promise.all(
      items.map(async (b) => {
        let modified = false;
        if (!b.learnerAvatar || b.learnerName === 'Học viên') {
          const snap = await this.getUserSnapshot(b.learnerId);
          if (snap.name && snap.name !== 'Thành viên') {
            b.learnerName = snap.name;
            modified = true;
          }
          if (snap.avatar) {
            b.learnerAvatar = snap.avatar;
            modified = true;
          }
        }
        if (!b.mentorAvatar || b.mentorName === 'Mentor') {
          const snap = await this.getUserSnapshot(b.mentorId);
          if (snap.name && snap.name !== 'Thành viên') {
            b.mentorName = snap.name;
            modified = true;
          }
          if (snap.avatar) {
            b.mentorAvatar = snap.avatar;
            modified = true;
          }
        }
        if (modified) {
          this.bookingRepo.save(b).catch(() => {});
        }
        return b;
      }),
    );

    return { items: enrichedItems, total };
  }

  /**
   * Lấy chi tiết 1 booking
   */
  async getBookingById(bookingId: string): Promise<Booking> {
    // 0. Quét kiểm tra hết hạn cho booking này
    await this.checkAndExpirePendingBookings(bookingId);

    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy thông tin đặt lịch');
    }
    return booking;
  }

  /**
   * POST /bookings/:bookingId/accept — Mentor chấp nhận booking (Luồng A)
   * hoặc Learner chấp nhận đề nghị (Luồng B)
   */
  async acceptBooking(userId: string, bookingId: string): Promise<Booking> {
    return this.respondBooking(userId, bookingId, { action: 'ACCEPT' });
  }

  /**
   * POST /bookings/:bookingId/complete — Hoàn thành buổi học & Giải phóng khoản ký quỹ cho Mentor
   */
  async completeBooking(userId: string, bookingId: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy bản ghi đặt lịch');
    }

    if (booking.mentorId !== userId && booking.learnerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xác nhận hoàn thành booking này');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      return booking;
    }

    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.STARTED) {
      throw new BadRequestException(`Chỉ có thể hoàn thành booking khi đang ở trạng thái "${booking.status}"`);
    }

    // 1. Giải phóng khoản ký quỹ từ Escrow sang ví khả dụng của Mentor
    if (booking.totalCreditEscrowed > 0) {
      try {
        await firstValueFrom(
          this.walletClient
            .send('session.ended', {
              bookingId: booking.id,
              learnerId: booking.learnerId,
              mentorId: booking.mentorId,
              creditsTransferred: booking.totalCreditEscrowed,
            })
            .pipe(timeout(7000)),
        );
      } catch (err: any) {
        this.logger.error(`Release escrow failed for booking ${booking.id}:`, err);
        throw new BadRequestException('Không thể giải phóng khoản ký quỹ credit sang Mentor. Vui lòng thử lại sau.');
      }
    }

    // 2. Cập nhật trạng thái Booking
    booking.status = BookingStatus.COMPLETED;
    booking.completedAt = new Date();
    const saved = await this.bookingRepo.save(booking);

    // 3. Gửi thông báo tới cả Learner và Mentor
    try {
      this.notificationClient.emit('notification.create', {
        userId: booking.mentorId,
        title: 'Buổi học hoàn tất!',
        content: `Buổi học "${booking.title}" đã hoàn tất. Bạn đã nhận được ${booking.totalCreditEscrowed} Credit.`,
        type: 'BOOKING_COMPLETED',
        referenceId: saved.id,
      });

      this.notificationClient.emit('notification.create', {
        userId: booking.learnerId,
        title: 'Buổi học hoàn tất!',
        content: `Buổi học "${booking.title}" đã hoàn tất. Cảm ơn bạn đã tham gia học tập!`,
        type: 'BOOKING_COMPLETED',
        referenceId: saved.id,
      });
    } catch (err) {
      this.logger.warn('Failed to emit complete notifications:', err);
    }

    return saved;
  }

  /**
   * POST /bookings/:bookingId/reject — Mentor từ chối booking
   */
  async rejectBooking(userId: string, bookingId: string, reason?: string): Promise<Booking> {
    return this.respondBooking(userId, bookingId, { action: 'REJECT', reason });
  }

  /**
   * POST /bookings/:bookingId/cancel — Hủy booking đã CONFIRMED
   */
  async cancelBooking(userId: string, bookingId: string, reason?: string): Promise<any> {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy bản ghi đặt lịch');
    }

    if (booking.mentorId !== userId && booking.learnerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền hủy booking này');
    }

    if (booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(`Booking đang ở trạng thái "${booking.status}", không thể hủy`);
    }

    const wasConfirmed = booking.status === BookingStatus.CONFIRMED;
    const isMentor = userId === booking.mentorId;
    let creditRefunded = false;
    let trustPenalty = 0;

    // Phạt Trust Score & Phí hủy nếu hủy sát giờ (<2h trước buổi học)
    const hoursUntilSession =
      (booking.scheduledStart.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLateCancel = wasConfirmed && hoursUntilSession < 2 && hoursUntilSession > 0;

    let refundAmount = booking.totalCreditEscrowed;
    let feeAmount = 0;

    if (isLateCancel) {
      // Người dạy hủy sát giờ: Trừ 10 điểm uy tín, hoàn trả 100% credit cho học viên
      // Học viên hủy sát giờ: Không trừ uy tín, trừ 10% credit phí hủy (đền bù cho Mentor)
      if (isMentor) {
        trustPenalty = -10;
        refundAmount = booking.totalCreditEscrowed;
        feeAmount = 0;
      } else {
        trustPenalty = 0;
        feeAmount = Math.round(booking.totalCreditEscrowed * 0.1);
        refundAmount = Math.max(0, booking.totalCreditEscrowed - feeAmount);
      }
    }

    // Nếu đã ký quỹ (CONFIRMED hoặc PENDING_MENTOR_APPROVAL từ Mentor Post) → hoàn credit cho Learner
    const isPendingLearnerEscrowed =
      booking.status === BookingStatus.PENDING_MENTOR_APPROVAL &&
      booking.origin === BookingOrigin.MENTOR_POST;

    if ((wasConfirmed || isPendingLearnerEscrowed) && booking.totalCreditEscrowed > 0) {
      if (isPendingLearnerEscrowed) {
        refundAmount = booking.totalCreditEscrowed;
        feeAmount = 0;
      }
      try {
        await firstValueFrom(
          this.walletClient
            .send('wallet.refundEscrow', {
              bookingId: booking.id,
              learnerId: booking.learnerId,
              amount: refundAmount,
              feeAmount,
              mentorId: booking.mentorId,
            })
            .pipe(timeout(7000)),
        );
        creditRefunded = true;
      } catch (err) {
        this.logger.error(`Refund escrow failed for booking ${booking.id}:`, err);
      }
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancellationReason = reason || 'Người dùng hủy';
    booking.cancelledBy = userId;
    booking.cancelledAt = new Date();
    await this.bookingRepo.save(booking);

    // Thông báo
    const targetUserId = userId === booking.mentorId ? booking.learnerId : booking.mentorId;
    try {
      this.notificationClient.emit('notification.create', {
        userId: targetUserId,
        title: 'Buổi học đã bị hủy',
        content: `Buổi học "${booking.title}" đã bị hủy. ${creditRefunded ? 'Credit đã được hoàn lại.' : ''}`,
        type: 'BOOKING_CANCELLED',
        referenceId: booking.id,
      });
    } catch (err) {
      this.logger.warn('Failed to emit cancellation notification:', err);
    }

    return {
      id: booking.id,
      status: booking.status,
      cancellationReason: booking.cancellationReason,
      creditRefunded,
      trustPenalty,
    };
  }

  /**
   * POST /bookings/:bookingId/no-show — Đánh dấu không đến
   */
  async markNoShow(userId: string, bookingId: string): Promise<any> {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy bản ghi đặt lịch');
    }

    if (booking.mentorId !== userId && booking.learnerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác booking này');
    }

    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.STARTED) {
      throw new BadRequestException('Chỉ có thể đánh dấu no-show khi booking đã được xác nhận hoặc đang diễn ra');
    }

    booking.status = BookingStatus.NO_SHOW;
    booking.cancelledAt = new Date();
    booking.cancelledBy = userId;
    await this.bookingRepo.save(booking);

    const trustPenalty = -15;

    // Thông báo
    const targetUserId = userId === booking.mentorId ? booking.learnerId : booking.mentorId;
    try {
      this.notificationClient.emit('notification.create', {
        userId: targetUserId,
        title: 'Đánh dấu không đến (No-show)',
        content: `Buổi học "${booking.title}" bị đánh dấu không có người tham gia.`,
        type: 'BOOKING_NO_SHOW',
        referenceId: booking.id,
      });
    } catch (err) {
      this.logger.warn('Failed to emit no-show notification:', err);
    }

    return {
      id: booking.id,
      status: booking.status,
      trustPenalty,
    };
  }
}
