import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @Inject('POST_SERVICE') private readonly postClient: ClientProxy,
    @Inject('WALLET_SERVICE') private readonly walletClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
  ) {}

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

    // 3. Gửi thông báo cho Mentor
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
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy bản ghi đặt lịch');
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
      booking.status = BookingStatus.REJECTED;
      booking.cancellationReason = dto.reason || 'Bị từ chối bởi người dùng';
      booking.cancelledBy = userId;
      booking.cancelledAt = new Date();
      return this.bookingRepo.save(booking);
    }

    // Trường hợp CHẤP NHẬN ➔ Gọi Wallet Microservice để Khóa/Ký quỹ Credit của Learner
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

    // Cập nhật trạng thái Booking thành CONFIRMED (Đã xác nhận & Ký quỹ thành công)
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
    let creditRefunded = false;
    let trustPenalty = 0;

    // Nếu đã ký quỹ (CONFIRMED) → hoàn credit cho Learner
    if (wasConfirmed && booking.totalCreditEscrowed > 0) {
      try {
        await firstValueFrom(
          this.walletClient
            .send('wallet.refundEscrow', {
              bookingId: booking.id,
              learnerId: booking.learnerId,
              amount: booking.totalCreditEscrowed,
            })
            .pipe(timeout(7000)),
        );
        creditRefunded = true;
      } catch (err) {
        this.logger.error(`Refund escrow failed for booking ${booking.id}:`, err);
      }
    }

    // Phạt Trust Score nếu hủy sát giờ (<2h trước buổi học)
    const hoursUntilSession =
      (booking.scheduledStart.getTime() - Date.now()) / (1000 * 60 * 60);
    if (wasConfirmed && hoursUntilSession < 2 && hoursUntilSession > 0) {
      trustPenalty = -5;
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
