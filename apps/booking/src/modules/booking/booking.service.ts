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
import { Repository, In, IsNull, LessThanOrEqual } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { Booking, BookingMessage, BookingReminder } from './entities';
import { ReminderChannel } from './enums';
import {
  CreateMentorPostBookingDto,
  CreateLearnerRequestBookingDto,
  RespondBookingDto,
  GetBookingsQueryDto,
  BookingOrigin,
  BookingStatus,
  SendBookingMessageDto,
} from '@app/contracts/booking';
import { NOTIFICATION_EVENTS } from '@app/contracts/events';
import { CloudinaryService } from '@app/common';

@Injectable()
export class BookingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingService.name);
  private expirationInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingMessage)
    private readonly bookingMessageRepo: Repository<BookingMessage>,
    @InjectRepository(BookingReminder)
    private readonly bookingReminderRepo: Repository<BookingReminder>,
    @Inject('POST_SERVICE') private readonly postClient: ClientProxy,
    @Inject('WALLET_SERVICE') private readonly walletClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async onModuleInit() {
    this.logger.log('BookingService initialized. Running initial checks for pending expirations & reminders...');
    await this.checkAndExpirePendingBookings();
    await this.checkAndSendBookingReminders();

    // Định kỳ quét các yêu cầu quá hạn và gửi nhắc nhở mỗi 1 phút
    this.expirationInterval = setInterval(() => {
      this.checkAndExpirePendingBookings().catch((err) => {
        this.logger.error('Error during scheduled checkAndExpirePendingBookings sweep:', err);
      });
      this.checkAndSendBookingReminders().catch((err) => {
        this.logger.error('Error during scheduled checkAndSendBookingReminders sweep:', err);
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
            this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
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
            this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
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
  private async getUserSnapshot(userId: string): Promise<{ name: string; avatar: string; trustScore: number }> {
    try {
      const userUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
      const res = await fetch(`${userUrl}/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        return {
          name: data.displayName || data.fullName || 'Thành viên',
          avatar: data.avatarUrl || '',
          trustScore: typeof data.trustScore === 'number' ? data.trustScore : 100,
        };
      }
    } catch (err) {
      this.logger.warn(`Could not fetch user snapshot for ${userId}: ${err}`);
    }
    return { name: 'Thành viên', avatar: '', trustScore: 100 };
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

    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    const startMs = start.getTime();
    const endMs = end.getTime();

    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
      throw new BadRequestException('Thời gian bắt đầu và kết thúc buổi học không hợp lệ');
    }

    // 1.1 Chống gửi trùng yêu cầu: Kiểm tra Learner đã có yêu cầu PENDING trùng khung giờ này cho bài đăng chưa
    const duplicatePending = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.sourcePostId = :postId', { postId: dto.mentorPostId })
      .andWhere('b.learnerId = :learnerId', { learnerId })
      .andWhere('b.status = :pendingStatus', { pendingStatus: BookingStatus.PENDING_MENTOR_APPROVAL })
      .andWhere('b.scheduledStart < :end AND b.scheduledEnd > :start', { start, end })
      .getOne();

    if (duplicatePending) {
      throw new BadRequestException('Bạn đã gửi một yêu cầu đặt lịch trong khung giờ này và đang chờ gia sư phản hồi');
    }

    // 1.2 Kiểm tra trùng lịch của chính Học viên (với các buổi học đã xác nhận hoặc đang diễn ra)
    const learnerConflict = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.status IN (:...activeStatuses)', {
        activeStatuses: [BookingStatus.CONFIRMED, BookingStatus.STARTED],
      })
      .andWhere('(b.mentorId = :learnerId OR b.learnerId = :learnerId)', { learnerId })
      .andWhere('b.scheduledStart < :end AND b.scheduledEnd > :start', { start, end })
      .getOne();

    if (learnerConflict) {
      throw new BadRequestException(`Bạn đã có một lịch học khác ("${learnerConflict.title}") trong khung giờ này`);
    }

    // 1.3 Kiểm tra Mentor đã có lịch học được xác nhận hoặc đang diễn ra trong khung giờ này chưa
    const mentorConflict = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.status IN (:...activeStatuses)', {
        activeStatuses: [BookingStatus.CONFIRMED, BookingStatus.STARTED],
      })
      .andWhere('(b.mentorId = :mentorId OR b.learnerId = :mentorId)', { mentorId: mentorPost.mentorId })
      .andWhere('b.scheduledStart < :end AND b.scheduledEnd > :start', { start, end })
      .getOne();

    if (mentorConflict) {
      throw new BadRequestException('Gia sư đã có lịch học được xác nhận trong khung giờ này, vui lòng chọn khung giờ khác');
    }

    // Lấy thông tin profile học viên
    const learnerSnap =
      learnerSnapshot?.name && learnerSnapshot.name !== 'Học viên'
        ? learnerSnapshot
        : await this.getUserSnapshot(learnerId);

    // 2. Tạo bản ghi Booking ở trạng thái CHỜ MENTOR DUYỆT
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
      scheduledStart: start,
      scheduledEnd: end,
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
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
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

    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    const startMs = start.getTime();
    const endMs = end.getTime();

    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
      throw new BadRequestException('Thời gian bắt đầu và kết thúc buổi học không hợp lệ');
    }

    // 1.1 Kiểm tra xem bài yêu cầu này đã được xác nhận với người dạy nào chưa
    const requestAlreadyConfirmed = await this.bookingRepo.findOne({
      where: {
        sourcePostId: dto.learnerRequestId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.STARTED, BookingStatus.COMPLETED]),
      },
    });
    if (requestAlreadyConfirmed) {
      throw new BadRequestException('Bài yêu cầu này đã được xác nhận với một người dạy khác');
    }

    // 1.2 Kiểm tra chống spam: Không cho phép gửi đề nghị dạy nhiều lần nếu đang có đề nghị chờ duyệt cho bài này
    const duplicatePendingOffer = await this.bookingRepo.findOne({
      where: {
        sourcePostId: dto.learnerRequestId,
        mentorId: mentorId,
        status: BookingStatus.PENDING_LEARNER_APPROVAL,
      },
    });

    if (duplicatePendingOffer) {
      throw new BadRequestException('Bạn đã gửi đề nghị dạy cho bài yêu cầu này và đang chờ học viên phản hồi');
    }

    // 1.3 Kiểm tra trùng lịch của chính Mentor trong khung giờ đề xuất
    const mentorConflict = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.status IN (:...activeStatuses)', {
        activeStatuses: [BookingStatus.CONFIRMED, BookingStatus.STARTED],
      })
      .andWhere('(b.mentorId = :mentorId OR b.learnerId = :mentorId)', { mentorId })
      .andWhere('b.scheduledStart < :end AND b.scheduledEnd > :start', { start, end })
      .getOne();

    if (mentorConflict) {
      throw new BadRequestException(`Bạn đã có một lịch học khác ("${mentorConflict.title}") trong khung giờ này`);
    }

    // Lấy thông tin profile người dạy
    const mentorSnap =
      mentorSnapshot?.name && mentorSnapshot.name !== 'Mentor'
        ? mentorSnapshot
        : await this.getUserSnapshot(mentorId);

    // 2. Tạo bản ghi Booking ở trạng thái CHỜ LEARNER DUYỆT
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
      scheduledStart: start,
      scheduledEnd: end,
      durationMinutes: duration,
      totalCreditEscrowed: duration,
      status: BookingStatus.PENDING_LEARNER_APPROVAL,
    });

    const saved = await this.bookingRepo.save(booking);

    // 3. Gửi thông báo cho Learner
    try {
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
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
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
        userId: targetUserId,
        title: 'Lịch học đã được xác nhận!',
        content: `Buổi học "${booking.title}" đã được xác nhận thành công và ký quỹ Credit.`,
        type: 'BOOKING_CONFIRMED',
        referenceId: saved.id,
      });
    } catch (err) {
      this.logger.warn('Failed to emit notification:', err);
    }

    // 4. Tạo lịch nhắc nhở tự động cho buổi học
    await this.createBookingReminders(saved);

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

    // Query message stats for these bookings
    const bookingIds = items.map((b) => b.id);
    const messageStatsMap = new Map<string, { count: number; lastSentAt?: Date }>();
    if (bookingIds.length > 0) {
      try {
        const stats = await this.bookingMessageRepo
          .createQueryBuilder('m')
          .select('m.booking_id', 'bookingId')
          .addSelect('COUNT(m.id)', 'count')
          .addSelect('MAX(m.sent_at)', 'lastSentAt')
          .where('m.booking_id IN (:...bookingIds)', { bookingIds })
          .groupBy('m.booking_id')
          .getRawMany();

        stats.forEach((s) => {
          messageStatsMap.set(s.bookingId, {
            count: parseInt(s.count, 10) || 0,
            lastSentAt: s.lastSentAt ? new Date(s.lastSentAt) : undefined,
          });
        });
      } catch (err) {
        this.logger.warn('Failed to query message stats:', err);
      }
    }

    // Enrich real profile names, avatars & trustScores for existing records
    const enrichedItems = await Promise.all(
      items.map(async (b) => {
        let modified = false;
        const learnerSnap = await this.getUserSnapshot(b.learnerId);
        const mentorSnap = await this.getUserSnapshot(b.mentorId);

        (b as any).learnerTrustScore = learnerSnap.trustScore || 100;
        (b as any).mentorTrustScore = mentorSnap.trustScore || 100;

        const stat = messageStatsMap.get(b.id);
        (b as any).hasMessages = (stat?.count || 0) > 0;
        (b as any).messageCount = stat?.count || 0;
        (b as any).lastMessageSentAt = stat?.lastSentAt;

        if (!b.learnerAvatar || b.learnerName === 'Học viên') {
          if (learnerSnap.name && learnerSnap.name !== 'Thành viên') {
            b.learnerName = learnerSnap.name;
            modified = true;
          }
          if (learnerSnap.avatar) {
            b.learnerAvatar = learnerSnap.avatar;
            modified = true;
          }
        }
        if (!b.mentorAvatar || b.mentorName === 'Mentor') {
          if (mentorSnap.name && mentorSnap.name !== 'Thành viên') {
            b.mentorName = mentorSnap.name;
            modified = true;
          }
          if (mentorSnap.avatar) {
            b.mentorAvatar = mentorSnap.avatar;
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

    const learnerSnap = await this.getUserSnapshot(booking.learnerId);
    const mentorSnap = await this.getUserSnapshot(booking.mentorId);
    (booking as any).learnerTrustScore = learnerSnap.trustScore || 100;
    (booking as any).mentorTrustScore = mentorSnap.trustScore || 100;

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
      if (booking.totalCreditEscrowed > 0) {
        try {
          await firstValueFrom(
            this.walletClient
              .send('wallet.releaseEscrow', {
                bookingId: booking.id,
                learnerId: booking.learnerId,
                mentorId: booking.mentorId,
                creditsTransferred: booking.totalCreditEscrowed,
              })
              .pipe(timeout(7000)),
          );
        } catch (err: any) {
          this.logger.warn(`Release escrow retry for completed booking ${booking.id}:`, err);
        }
      }
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
            .send('wallet.releaseEscrow', {
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
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
        userId: booking.mentorId,
        title: 'Buổi học hoàn tất!',
        content: `Buổi học "${booking.title}" đã hoàn tất. Bạn đã nhận được ${booking.totalCreditEscrowed} Credit.`,
        type: 'BOOKING_COMPLETED',
        referenceId: saved.id,
      });

      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
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

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REJECTED ||
      booking.status === BookingStatus.EXPIRED
    ) {
      throw new BadRequestException(`Booking đang ở trạng thái "${booking.status}", không thể hủy`);
    }

    if (booking.status === BookingStatus.STARTED) {
      throw new BadRequestException('Buổi học đang diễn ra, không thể hủy.');
    }

    const now = Date.now();
    const startTimeMs = new Date(booking.scheduledStart).getTime();
    if (booking.status === BookingStatus.CONFIRMED && now >= startTimeMs) {
      throw new BadRequestException('Buổi học đã đến giờ hoặc đang diễn ra, không thể hủy.');
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

    // Xóa tất cả các lịch nhắc nhở chưa bắn của booking này khi hủy
    try {
      await this.bookingReminderRepo.delete({ bookingId: booking.id });
      this.logger.log(`Deleted pending reminders for cancelled booking ${booking.id}`);
    } catch (err) {
      this.logger.warn(`Failed to delete reminders for cancelled booking ${booking.id}:`, err);
    }

    // Thông báo
    const targetUserId = userId === booking.mentorId ? booking.learnerId : booking.mentorId;
    try {
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
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
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
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

  private activeTypingMap = new Map<string, { userId: string; until: number }>();

  setTypingStatus(userId: string, bookingId: string, typing: boolean) {
    if (typing) {
      this.activeTypingMap.set(bookingId, { userId, until: Date.now() + 4000 });
    } else {
      const current = this.activeTypingMap.get(bookingId);
      if (current && current.userId === userId) {
        this.activeTypingMap.delete(bookingId);
      }
    }
    return { success: true };
  }

  getTypingPartner(userId: string, bookingId: string): boolean {
    const current = this.activeTypingMap.get(bookingId);
    if (!current) return false;
    if (Date.now() > current.until) {
      this.activeTypingMap.delete(bookingId);
      return false;
    }
    return current.userId !== userId;
  }

  /**
   * GET /bookings/:bookingId/messages — Lấy danh sách tin nhắn của buổi học
   */
  async getBookingMessages(userId: string, bookingId: string): Promise<any> {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy bản ghi đặt lịch');
    }

    if (booking.mentorId !== userId && booking.learnerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem tin nhắn của buổi học này');
    }

    const allowedStatuses: string[] = [
      BookingStatus.CONFIRMED,
      BookingStatus.STARTED,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.REJECTED,
      BookingStatus.EXPIRED,
      BookingStatus.NO_SHOW,
    ];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException('Chỉ có thể truy cập tin nhắn khi buổi học đã được xác nhận hoặc xử lý.');
    }

    // Tìm tất cả các booking liên quan giữa 2 người (để giữ trọn vẹn lịch sử tin nhắn dù đã hủy hay book lại)
    const relatedBookings = await this.bookingRepo.find({
      where: {
        learnerId: booking.learnerId,
        mentorId: booking.mentorId,
      },
      select: { id: true, sourcePostId: true },
    });

    const matchingBookings = booking.sourcePostId
      ? relatedBookings.filter((b) => b.sourcePostId === booking.sourcePostId)
      : relatedBookings;

    const relatedIds = matchingBookings.map((b) => b.id);
    if (!relatedIds.includes(bookingId)) {
      relatedIds.push(bookingId);
    }

    // Đánh dấu đã xem (read_at) cho tất cả tin nhắn gửi tới user hiện tại
    await this.bookingMessageRepo
      .createQueryBuilder()
      .update(BookingMessage)
      .set({ readAt: new Date() })
      .where('booking_id IN (:...relatedIds)', { relatedIds })
      .andWhere('sender_id != :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();

    const messages = await this.bookingMessageRepo.find({
      where: { bookingId: In(relatedIds) },
      order: { sentAt: 'ASC' },
    });

    const enriched = messages.map((m) => {
      const isSenderMentor = m.senderId === booking.mentorId;
      return {
        ...m,
        senderName: isSenderMentor ? booking.mentorName : booking.learnerName,
        senderAvatar: isSenderMentor ? booking.mentorAvatar : booking.learnerAvatar,
      };
    });

    const isPartnerTyping = this.getTypingPartner(userId, bookingId);

    return {
      items: enriched,
      isPartnerTyping,
    };
  }


  /**
   * POST /bookings/:bookingId/messages — Gửi tin nhắn trao đổi trước buổi học
   */
  async sendBookingMessage(
    userId: string,
    bookingId: string,
    dto: SendBookingMessageDto,
  ): Promise<any> {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy bản ghi đặt lịch');
    }

    if (booking.mentorId !== userId && booking.learnerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền gửi tin nhắn trong buổi học này');
    }

    const allowedStatuses: string[] = [BookingStatus.CONFIRMED, BookingStatus.STARTED];
    if (!allowedStatuses.includes(booking.status)) {
      throw new BadRequestException('Chỉ có thể gửi tin nhắn khi buổi học đang diễn ra hoặc đã được xác nhận.');
    }



    // Auto-detect message type if not explicitly supplied
    let msgType = dto.type || 'TEXT';
    if (!dto.type) {
      if (dto.attachmentUrl) {
        msgType = dto.attachmentMime?.startsWith('image/') ? 'IMAGE' : 'FILE';
      } else {
        const trimmed = (dto.content || '').trim();
        const isUrl = /^https?:\/\/[^\s]+$/i.test(trimmed) || /^(meet\.google\.com|zoom\.us|github\.com|figma\.com|drive\.google\.com)/i.test(trimmed);
        if (isUrl) {
          msgType = 'LINK';
        }
      }
    }

    let verifiedAttachment:
      | { url: string; bytes: number; publicId: string; resourceType: string }
      | undefined;
    if (dto.attachmentUrl || dto.attachmentPublicId) {
      if (!dto.attachmentPublicId || !dto.attachmentResourceType) {
        throw new BadRequestException('Thiếu metadata xác minh direct upload');
      }
      verifiedAttachment = await this.cloudinaryService.verifyDirectUpload({
        publicId: dto.attachmentPublicId,
        resourceType: dto.attachmentResourceType,
        expectedPublicIdPrefix: `unitimebank/chat-attachments/${bookingId}/${userId}_`,
        maxBytes: 10 * 1024 * 1024,
        allowedFormats:
          dto.attachmentResourceType === 'image'
            ? ['jpg', 'jpeg', 'png', 'webp', 'gif']
            : undefined,
      });
    }

    const newMsg = this.bookingMessageRepo.create({
      bookingId,
      senderId: userId,
      type: msgType,
      content: dto.content,
      attachmentUrl: verifiedAttachment?.url,
      attachmentName: dto.attachmentName,
      attachmentSize: verifiedAttachment?.bytes,
      attachmentMime: dto.attachmentMime,
    });

    const saved = await this.bookingMessageRepo.save(newMsg);

    // Gửi thông báo tới người nhận đối tác
    const targetUserId = userId === booking.mentorId ? booking.learnerId : booking.mentorId;
    const senderName = userId === booking.mentorId ? booking.mentorName : booking.learnerName;
    const senderAvatar = userId === booking.mentorId ? booking.mentorAvatar : booking.learnerAvatar;

    try {
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
        userId: targetUserId,
        title: `Tin nhắn mới từ ${senderName || 'Đối tác học tập'}`,
        content:
          dto.type === 'IMAGE'
            ? 'Đã gửi một hình ảnh'
            : dto.type === 'FILE'
            ? `Đã gửi tệp đính kèm: ${dto.attachmentName || 'Tài liệu'}`
            : dto.content.length > 80
            ? `${dto.content.substring(0, 80)}...`
            : dto.content,
        type: 'CHAT_MESSAGE',
        referenceId: booking.id,
        avatarUrl: senderAvatar,
      });
    } catch (err) {
      this.logger.warn('Failed to emit message notification:', err);
    }

    const isSenderMentor = saved.senderId === booking.mentorId;
    return {
      ...saved,
      senderName: isSenderMentor ? booking.mentorName : booking.learnerName,
      senderAvatar: isSenderMentor ? booking.mentorAvatar : booking.learnerAvatar,
    };
  }

  /**
   * Tạo bản ghi nhắc nhở (Reminder) cho cả Mentor và Learner trước buổi học 30 phút
   */
  async createBookingReminders(booking: Booking): Promise<void> {
    try {
      if (!booking || booking.status !== BookingStatus.CONFIRMED) return;

      const scheduledStartMs = new Date(booking.scheduledStart).getTime();
      const fireAt15 = new Date(scheduledStartMs - 30 * 60 * 1000);
      const fireAt = fireAt15.getTime() > Date.now() ? fireAt15 : new Date(Date.now() + 30 * 1000);

      // Tạo reminder cho Mentor
      const mentorReminder = this.bookingReminderRepo.create({
        bookingId: booking.id,
        recipientId: booking.mentorId,
        fireAt,
        channel: ReminderChannel.IN_APP,
      });

      // Tạo reminder cho Learner
      const learnerReminder = this.bookingReminderRepo.create({
        bookingId: booking.id,
        recipientId: booking.learnerId,
        fireAt,
        channel: ReminderChannel.IN_APP,
      });

      await this.bookingReminderRepo.save([mentorReminder, learnerReminder]);
      this.logger.log(`Created reminders for booking ${booking.id} to fire at ${fireAt.toISOString()}`);
    } catch (err) {
      this.logger.error(`Failed to create reminders for booking ${booking?.id}:`, err);
    }
  }

  /**
   * Quét và gửi thông báo nhắc nhở các buổi học sắp đến giờ
   */
  async checkAndSendBookingReminders(): Promise<void> {
    try {
      const now = new Date();
      const dueReminders = await this.bookingReminderRepo.find({
        where: {
          sentAt: IsNull(),
          fireAt: LessThanOrEqual(now),
        },
        relations: { booking: true },
      });

      if (!dueReminders.length) return;

      this.logger.log(`Found ${dueReminders.length} due reminders to send`);

      for (const reminder of dueReminders) {
        const booking = reminder.booking;
        if (
          booking &&
          (booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.STARTED)
        ) {
          const isMentor = reminder.recipientId === booking.mentorId;
          const partnerName = isMentor
            ? booking.learnerName || 'Học viên'
            : booking.mentorName || 'Mentor';

          try {
            this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
              userId: reminder.recipientId,
              title: 'Nhắc nhở: Lịch học sắp bắt đầu!',
              content: `Buổi học "${booking.title}" với ${partnerName} sắp diễn ra. Hãy chuẩn bị sẵn sàng nhé!`,
              type: 'BOOKING_REMINDER',
              referenceId: booking.id,
              avatarUrl: isMentor ? booking.learnerAvatar : booking.mentorAvatar,
            });
            this.logger.log(
              `Sent BOOKING_REMINDER for booking ${booking.id} to user ${reminder.recipientId}`,
            );
          } catch (emitErr) {
            this.logger.warn(`Failed to emit reminder for booking ${booking.id}:`, emitErr);
          }
        } else {
          this.logger.log(
            `Skipping reminder for booking ${booking?.id || reminder.bookingId} due to status: ${
              booking?.status
            }`,
          );
        }

        reminder.sentAt = new Date();
        await this.bookingReminderRepo.save(reminder);
      }
    } catch (err) {
      this.logger.error('Error during scheduled checkAndSendBookingReminders sweep:', err);
    }
  }

  async findByIdInternal(id: string): Promise<Booking | null> {
    return this.bookingRepo.findOne({ where: { id } });
  }

  async updateStatusInternal(id: string, status: BookingStatus): Promise<Booking | null> {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) return null;
    booking.status = status;
    return this.bookingRepo.save(booking);
  }

  /**
   * Lấy danh sách các khung giờ đã có lịch (CONFIRMED / STARTED) của Mentor trong khoảng ngày
   */
  async getBusySlots(mentorId: string, fromStr?: string, toStr?: string) {
    const qb = this.bookingRepo.createQueryBuilder('b')
      .where('(b.mentorId = :mentorId OR b.learnerId = :mentorId)', { mentorId })
      .andWhere('b.status IN (:...activeStatuses)', {
        activeStatuses: [BookingStatus.CONFIRMED, BookingStatus.STARTED],
      });

    if (fromStr) {
      const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
      if (!isNaN(fromDate.getTime())) {
        qb.andWhere('b.scheduledEnd >= :fromDate', { fromDate });
      }
    }

    if (toStr) {
      const toDate = new Date(`${toStr}T23:59:59.999Z`);
      if (!isNaN(toDate.getTime())) {
        qb.andWhere('b.scheduledStart <= :toDate', { toDate });
      }
    }

    const bookings = await qb
      .select(['b.id', 'b.scheduledStart', 'b.scheduledEnd', 'b.title', 'b.status', 'b.sourcePostId'])
      .orderBy('b.scheduledStart', 'ASC')
      .getMany();

    const data = bookings.map((b) => {
      const start = new Date(b.scheduledStart);
      const end = new Date(b.scheduledEnd);

      const pad = (n: number) => String(n).padStart(2, '0');
      const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      const endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

      return {
        id: b.id,
        date,
        startTime,
        endTime,
        scheduledStart: b.scheduledStart,
        scheduledEnd: b.scheduledEnd,
        status: b.status,
        sourcePostId: b.sourcePostId,
      };
    });

    return { data };
  }
}
