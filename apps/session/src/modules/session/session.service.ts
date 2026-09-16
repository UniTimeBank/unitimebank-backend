import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  RoomSession,
  RoomParticipant,
  RoomChatMessage,
  HeartbeatTick,
  AfkDetection,
  TrialLessonUsage,
  ScreenRecording,
  HostAction,
  ConnectionEvent,
} from './entities';
import {
  RoomType,
  RoomStatus,
  RoomCloseReason,
  ParticipantRole,
  ConnectionStatus,
  RecordingStatus,
  CreateGroupRoomDto,
  GetActiveGroupRoomsQueryDto,
  LiveKitTokenResponse,
} from '@app/contracts/session';
import { EventType, HostActionType as LocalHostActionType } from './enums';
import { NOTIFICATION_EVENTS } from '@app/contracts/events';
import { LiveKitService } from '@app/common/livekit';
import { CloudinaryService } from '@app/common/cloudinary';

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);
  private readonly GROUP_FREE_SECONDS = 5 * 60;
  private readonly GROUP_HEARTBEAT_MAX_GAP_SECONDS = 90;

  constructor(
    @InjectRepository(RoomSession)
    private readonly roomRepo: Repository<RoomSession>,
    @InjectRepository(RoomParticipant)
    private readonly participantRepo: Repository<RoomParticipant>,
    @InjectRepository(RoomChatMessage)
    private readonly chatMessageRepo: Repository<RoomChatMessage>,
    @InjectRepository(HeartbeatTick)
    private readonly heartbeatRepo: Repository<HeartbeatTick>,
    @InjectRepository(AfkDetection)
    private readonly afkRepo: Repository<AfkDetection>,
    @InjectRepository(TrialLessonUsage)
    private readonly trialRepo: Repository<TrialLessonUsage>,
    @InjectRepository(ScreenRecording)
    private readonly recordingRepo: Repository<ScreenRecording>,
    @InjectRepository(HostAction)
    private readonly hostActionRepo: Repository<HostAction>,
    @InjectRepository(ConnectionEvent)
    private readonly connectionEventRepo: Repository<ConnectionEvent>,
    @Inject('WALLET_SERVICE') private readonly walletClient: ClientProxy,
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    @Inject('POST_SERVICE') private readonly postClient: ClientProxy,
    private readonly livekitService: LiveKitService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async onModuleInit() {
    try {
      await this.roomRepo.query(`
        DO $$
        BEGIN
          ALTER TABLE "room_session" ADD COLUMN IF NOT EXISTS "host_disconnected_at" TIMESTAMPTZ NULL;
          ALTER TABLE "room_session" ADD COLUMN IF NOT EXISTS "skills" TEXT[] NULL;
          ALTER TABLE "room_session" ADD COLUMN IF NOT EXISTS "cover_image" TEXT NULL;
        EXCEPTION
          WHEN others THEN null;
        END $$;
      `);
      await this.roomRepo.query(`
        DO $$
        BEGIN
          ALTER TYPE "room_session_closereason_enum" ADD VALUE IF NOT EXISTS 'HOST_ABSENT_TIMEOUT';
        EXCEPTION
          WHEN others THEN null;
        END $$;
      `);
      this.logger.log('Session table columns & enums verified');
    } catch (err) {
      this.logger.warn('Error running session migrations in onModuleInit:', err);
    }
  }

  /**
   * Kiểm tra xem Chủ phòng (Mentor) của phòng học nhóm có đang hiện diện (ONLINE) hay không
   */
  async isHostPresentInGroupRoom(room: RoomSession): Promise<boolean> {
    const hostParticipant = await this.participantRepo.findOne({
      where: {
        roomId: room.id,
        userId: room.mentorId,
      },
    });

    if (!hostParticipant) return false;
    if (hostParticipant.connectionStatus !== ConnectionStatus.ONLINE) return false;

    // Kiểm tra nhịp tim hoặc thời gian tham gia gần nhất của Host: nếu quá 90s không tương tác thì coi là vắng mặt
    const lastActive = hostParticipant.lastHeartbeatAt || hostParticipant.joinedAt;
    if (lastActive) {
      const gapSeconds =
        (Date.now() - new Date(lastActive).getTime()) / 1000;
      if (gapSeconds > this.GROUP_HEARTBEAT_MAX_GAP_SECONDS) {
        return false;
      }
    }

    return true;
  }

  /**
   * Lấy trạng thái hiện diện và thời gian vắng mặt của Host trong phòng học nhóm
   */
  async getHostPresence(roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room || room.roomType !== RoomType.GROUP) {
      return { roomId, isHostPresent: true, hostAbsentSecondsRemaining: 300 };
    }

    const isHostPresent = await this.isHostPresentInGroupRoom(room);
    let hostAbsentSecondsRemaining = 300;
    if (!isHostPresent) {
      if (!room.hostDisconnectedAt) {
        room.hostDisconnectedAt = new Date();
        await this.roomRepo.save(room);
      }
      const elapsed = Math.floor(
        (Date.now() - new Date(room.hostDisconnectedAt).getTime()) / 1000,
      );
      hostAbsentSecondsRemaining = Math.max(0, 300 - elapsed);
    }

    return {
      roomId: room.id,
      isHostPresent,
      hostDisconnectedAt: room.hostDisconnectedAt
        ? new Date(room.hostDisconnectedAt).toISOString()
        : null,
      hostAbsentSecondsRemaining,
    };
  }

  /**
   * Ghi nhận Host ngắt kết nối khỏi phòng học nhóm
   */
  async recordHostDisconnected(
    roomId: string,
    userId: string,
    disconnectedAt?: string | Date,
  ) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (room && room.roomType === RoomType.GROUP && room.mentorId === userId) {
      if (!room.hostDisconnectedAt) {
        room.hostDisconnectedAt = disconnectedAt
          ? new Date(disconnectedAt)
          : new Date();
        await this.roomRepo.save(room);
      }
      const hostParticipant = await this.participantRepo.findOne({
        where: { roomId, userId },
      });
      if (hostParticipant) {
        hostParticipant.connectionStatus = ConnectionStatus.DISCONNECTED;
        hostParticipant.leftAt = room.hostDisconnectedAt;
        await this.participantRepo.save(hostParticipant);
      }
    }
    return { success: true };
  }

  // ════════════════════════════════════════════════════════════════
  // 1. PHÒNG HỌC 1:1 (ONE-ON-ONE ROOMS)
  // ════════════════════════════════════════════════════════════════

  /**
   * POST /rooms/one-on-one/:bookingId/open — Mentor mở phòng học 1:1
   */
  async openOneOnOneRoom(userId: string, bookingId: string): Promise<LiveKitTokenResponse> {
    // 1. Lấy thông tin Booking từ BookingService
    const booking = await this.getBookingById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy thông tin đặt lịch.');
    }

    if (booking.mentorId !== userId) {
      throw new ForbiddenException('Chỉ Mentor của buổi học mới có quyền mở phòng học.');
    }

    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED' || booking.status === 'COMPLETED') {
      throw new BadRequestException(`Không thể mở phòng học cho buổi học ở trạng thái ${booking.status}.`);
    }

    // 2. Tìm hoặc tạo RoomSession
    let room = await this.roomRepo.findOne({
      where: { bookingId: booking.id },
      relations: { participants: true },
    });

    if (!room) {
      room = this.roomRepo.create({
        roomType: RoomType.ONE_ON_ONE,
        mentorId: booking.mentorId,
        learnerId: booking.learnerId,
        bookingId: booking.id,
        livekitRoomName: `utb-1on1-${booking.id}`,
        status: RoomStatus.IN_PROGRESS,
        scheduledStart: booking.scheduledStart,
        scheduledEnd: booking.scheduledEnd,
        openedAt: new Date(),
      });
      room = await this.roomRepo.save(room);
    } else {
      room.status = RoomStatus.IN_PROGRESS;
      if (!room.openedAt) room.openedAt = new Date();
      room = await this.roomRepo.save(room);
    }

    // 3. Tạo/Cập nhật Participant cho Mentor
    let mentorParticipant = await this.participantRepo.findOne({
      where: { roomId: room.id, userId },
    });

    if (!mentorParticipant) {
      mentorParticipant = this.participantRepo.create({
        roomId: room.id,
        userId,
        role: ParticipantRole.MENTOR,
        joinedAt: new Date(),
        connectionStatus: ConnectionStatus.ONLINE,
      });
      await this.participantRepo.save(mentorParticipant);
    } else {
      mentorParticipant.connectionStatus = ConnectionStatus.ONLINE;
      mentorParticipant.joinedAt = new Date();
      mentorParticipant.leftAt = null as any;
      await this.participantRepo.save(mentorParticipant);
    }

    // 4. Cập nhật trạng thái Booking sang STARTED
    try {
      await firstValueFrom(
        this.bookingClient
          .send('booking.updateStatus', { id: booking.id, status: 'STARTED' })
          .pipe(timeout(5000)),
      );
    } catch (err) {
      this.logger.warn(`Failed to update booking ${booking.id} status to STARTED:`, err);
    }

    // 5. Gửi thông báo cho Learner biết Mentor đã mở phòng
    try {
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
        userId: booking.learnerId,
        title: 'Phòng học 1:1 đã mở!',
        content: `Mentor đã mở phòng học "${booking.title}". Hãy tham gia ngay để bắt đầu buổi học!`,
        type: 'BOOKING_STARTED',
        referenceId: booking.id,
        avatarUrl: booking.mentorAvatar,
      });
    } catch (err) {
      this.logger.warn('Failed to emit notification for room open:', err);
    }

    // 6. Sinh LiveKit AccessToken
    const { token, wsUrl } = await this.livekitService.generateToken({
      roomName: room.livekitRoomName,
      identity: userId,
      name: booking.mentorName || 'Mentor',
      role: ParticipantRole.MENTOR,
    });

    // 7. Ghi nhận ConnectionEvent
    await this.recordConnectionEvent(room.id, mentorParticipant.id, EventType.CONNECTED);

    return {
      roomId: room.id,
      roomType: RoomType.ONE_ON_ONE,
      livekitRoomName: room.livekitRoomName,
      livekitToken: token,
      livekitWsUrl: wsUrl,
      status: room.status,
      role: ParticipantRole.MENTOR,
      bookingId: booking.id,
      mentorId: booking.mentorId,
      learnerId: booking.learnerId,
      escrowedCredit: booking.totalCreditEscrowed || 0,
      canJoin: true,
    };
  }

  /**
   * POST /rooms/one-on-one/:bookingId/join — Learner (hoặc Mentor) tham gia phòng học 1:1
   */
  async joinOneOnOneRoom(userId: string, bookingId: string): Promise<LiveKitTokenResponse> {
    this.logger.log(`[joinOneOnOneRoom] Request: userId=${userId}, bookingId=${bookingId}`);
    const booking = await this.getBookingById(bookingId);
    if (!booking) {
      this.logger.error(`[joinOneOnOneRoom] Booking ${bookingId} not found`);
      throw new NotFoundException('Không tìm thấy thông tin đặt lịch.');
    }

    const isMentor = String(booking.mentorId) === String(userId);
    const isLearner = String(booking.learnerId) === String(userId);

    if (!isMentor && !isLearner) {
      this.logger.warn(
        `[joinOneOnOneRoom] Access denied for user ${userId}. Mentor is ${booking.mentorId}, Learner is ${booking.learnerId}`,
      );
      throw new ForbiddenException('Bạn không phải là thành viên của buổi học này.');
    }

    let room = await this.roomRepo.findOne({
      where: { bookingId: booking.id },
    });

    if (!room) {
      if (
        booking.status !== 'CONFIRMED' &&
        booking.status !== 'STARTED'
      ) {
        this.logger.warn(
          `[joinOneOnOneRoom] Booking ${bookingId} has invalid status "${booking.status}" for joining`,
        );
        throw new BadRequestException(
          `Không thể tham gia buổi học ở trạng thái "${booking.status}".`,
        );
      }

      // Tự động khởi tạo phòng học 1:1 khi người học hoặc mentor vào phòng
      room = this.roomRepo.create({
        roomType: RoomType.ONE_ON_ONE,
        mentorId: booking.mentorId,
        learnerId: booking.learnerId,
        bookingId: booking.id,
        livekitRoomName: `utb-1on1-${booking.id}`,
        status: RoomStatus.IN_PROGRESS,
        scheduledStart: booking.scheduledStart ? new Date(booking.scheduledStart) : undefined,
        scheduledEnd: booking.scheduledEnd ? new Date(booking.scheduledEnd) : undefined,
        openedAt: new Date(),
      });
      room = await this.roomRepo.save(room);

      // Cập nhật trạng thái booking sang STARTED nếu đang CONFIRMED
      if (booking.status === 'CONFIRMED') {
        try {
          await firstValueFrom(
            this.bookingClient
              .send('booking.updateStatus', { id: booking.id, status: 'STARTED' })
              .pipe(timeout(5000)),
          );
        } catch (err) {
          this.logger.warn(`Failed to update booking ${booking.id} status to STARTED:`, err);
        }
      }
    } else if (room.status === RoomStatus.SCHEDULED || room.status === RoomStatus.WAITING) {
      room.status = RoomStatus.IN_PROGRESS;
      if (!room.openedAt) room.openedAt = new Date();
      room = await this.roomRepo.save(room);
    }

    if (room.status === RoomStatus.COMPLETED || room.status === RoomStatus.CANCELLED) {
      throw new BadRequestException(`Phòng học đã kết thúc (${room.status}).`);
    }

    const role = isMentor ? ParticipantRole.MENTOR : ParticipantRole.LEARNER;

    // Tạo/Cập nhật Participant
    let participant = await this.participantRepo.findOne({
      where: { roomId: room.id, userId },
    });

    if (!participant) {
      participant = this.participantRepo.create({
        roomId: room.id,
        userId,
        role,
        joinedAt: new Date(),
        connectionStatus: ConnectionStatus.ONLINE,
      });
      await this.participantRepo.save(participant);
    } else {
      if (participant.isKicked) {
        throw new ForbiddenException('Bạn đã bị mời ra khỏi phòng học này.');
      }
      participant.connectionStatus = ConnectionStatus.ONLINE;
      participant.joinedAt = new Date();
      participant.leftAt = null as any;
      await this.participantRepo.save(participant);
    }

    const displayName = isMentor ? (booking.mentorName || 'Mentor') : (booking.learnerName || 'Learner');

    const { token, wsUrl } = await this.livekitService.generateToken({
      roomName: room.livekitRoomName,
      identity: userId,
      name: displayName,
      role,
    });

    await this.recordConnectionEvent(room.id, participant.id, EventType.CONNECTED);

    return {
      roomId: room.id,
      roomType: RoomType.ONE_ON_ONE,
      livekitRoomName: room.livekitRoomName,
      livekitToken: token,
      livekitWsUrl: wsUrl,
      status: room.status,
      role,
      bookingId: booking.id,
      mentorId: booking.mentorId,
      learnerId: booking.learnerId,
      escrowedCredit: booking.totalCreditEscrowed || 0,
      canJoin: true,
    };
  }

  /**
   * POST /rooms/one-on-one/:bookingId/close — Mentor đóng phòng học 1:1 & Giải phóng Escrow
   */
  async closeOneOnOneRoom(
    userId: string,
    bookingId: string,
    closeReason?: RoomCloseReason,
  ): Promise<{
    roomId: string;
    status: RoomStatus;
    closedAt: Date;
    creditsTransferred: number;
  }> {
    const booking = await this.getBookingById(bookingId);
    if (!booking) {
      throw new NotFoundException('Không tìm thấy thông tin đặt lịch.');
    }

    if (booking.mentorId !== userId) {
      throw new ForbiddenException('Chỉ Mentor mới có quyền kết thúc buổi học.');
    }

    let room = await this.roomRepo.findOne({
      where: { bookingId: booking.id },
    });

    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng học.');
    }

    const closedAt = new Date();
    room.status = RoomStatus.COMPLETED;
    room.closedAt = closedAt;
    room.closeReason = closeReason || RoomCloseReason.HOST_CLOSED;
    await this.roomRepo.save(room);

    // 1. Giải phóng tiền ký quỹ qua Wallet Service
    const creditsToTransfer = booking.totalCreditEscrowed || 0;
    try {
      await firstValueFrom(
        this.walletClient
          .send('wallet.releaseEscrow', {
            roomId: room.id,
            bookingId: booking.id,
            learnerId: booking.learnerId,
            mentorId: booking.mentorId,
            creditsTransferred: creditsToTransfer,
          })
          .pipe(timeout(8000)),
      );
      this.logger.log(
        `Successfully released escrow of ${creditsToTransfer} credits for booking ${booking.id} to mentor ${booking.mentorId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to release escrow for booking ${booking.id}:`, err);
    }

    // 2. Cập nhật trạng thái Booking sang COMPLETED
    try {
      await firstValueFrom(
        this.bookingClient
          .send('booking.updateStatus', { id: booking.id, status: 'COMPLETED' })
          .pipe(timeout(5000)),
      );
    } catch (err) {
      this.logger.warn(`Failed to update booking ${booking.id} to COMPLETED:`, err);
    }

    // 3. Đánh dấu tất cả participants đã rời phòng
    const activeParticipants = await this.participantRepo.find({
      where: { roomId: room.id, connectionStatus: ConnectionStatus.ONLINE },
    });
    for (const p of activeParticipants) {
      p.leftAt = closedAt;
      p.connectionStatus = ConnectionStatus.DISCONNECTED;
      await this.participantRepo.save(p);
      await this.recordConnectionEvent(room.id, p.id, EventType.DISCONNECTED);
    }

    return {
      roomId: room.id,
      status: RoomStatus.COMPLETED,
      closedAt,
      creditsTransferred: creditsToTransfer,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // 2. PHÒNG HỌC NHÓM (GROUP STUDY ROOMS)
  // ════════════════════════════════════════════════════════════════

  /**
   * POST /rooms/group — Mentor tạo phòng học nhóm
   */
  async createGroupRoom(userId: string, dto: CreateGroupRoomDto): Promise<LiveKitTokenResponse> {
    const room = this.roomRepo.create({
      roomType: RoomType.GROUP,
      mentorId: userId,
      livekitRoomName: `utb-group-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      status: RoomStatus.IN_PROGRESS,
      title: dto.title?.trim() || 'Phòng học nhóm trực tuyến',
      category: dto.category?.trim() || undefined,
      skills: dto.skills && dto.skills.length > 0 ? dto.skills : undefined,
      coverImage: dto.coverImage || undefined,
      maxParticipants: dto.maxParticipants ? Math.max(1, dto.maxParticipants) : 20,
      postId: dto.postId || undefined,
      openedAt: new Date(),
    });
    const savedRoom = await this.roomRepo.save(room);

    const mentorParticipant = this.participantRepo.create({
      roomId: savedRoom.id,
      userId,
      role: ParticipantRole.MENTOR,
      joinedAt: new Date(),
      lastHeartbeatAt: new Date(),
      connectionStatus: ConnectionStatus.ONLINE,
    });
    await this.participantRepo.save(mentorParticipant);

    const { token, wsUrl } = await this.livekitService.generateToken({
      roomName: savedRoom.livekitRoomName,
      identity: userId,
      name: 'Mentor',
      role: ParticipantRole.MENTOR,
    });

    await this.recordConnectionEvent(savedRoom.id, mentorParticipant.id, EventType.CONNECTED);

    return {
      roomId: savedRoom.id,
      roomType: RoomType.GROUP,
      livekitRoomName: savedRoom.livekitRoomName,
      livekitToken: token,
      livekitWsUrl: wsUrl,
      status: savedRoom.status,
      role: ParticipantRole.MENTOR,
      mentorId: userId,
      canJoin: true,
    };
  }

  /**
   * POST /rooms/group/:roomId/join — Learner tham gia phòng học nhóm
   */
  async joinGroupRoom(userId: string, roomId: string): Promise<LiveKitTokenResponse> {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng học nhóm.');
    }

    if (room.status !== RoomStatus.IN_PROGRESS) {
      throw new BadRequestException('Phòng học nhóm này hiện không hoạt động.');
    }

    const isMentor = room.mentorId === userId;
    const role = isMentor ? ParticipantRole.MENTOR : ParticipantRole.LEARNER;

    // Kiểm tra giới hạn số người tham gia tối đa (nếu có)
    if (room.maxParticipants && !isMentor) {
      const activeCount = await this.participantRepo.count({
        where: { roomId: room.id, connectionStatus: ConnectionStatus.ONLINE },
      });
      if (activeCount >= room.maxParticipants) {
        throw new BadRequestException('Phòng học nhóm đã đạt giới hạn số người tham gia tối đa.');
      }
    }

    let availableBalance = 0;

    // Learner cần ít nhất 1 Credit để có thể tiếp tục sau 5 phút miễn phí.
    if (!isMentor) {
      try {
        const wallet = await firstValueFrom(
          this.walletClient.send('wallet.findOne', { userId }).pipe(timeout(5000)),
        );
        availableBalance = wallet?.availableBalance || 0;
        if (availableBalance < 1) {
          throw new BadRequestException(
            'Bạn cần tối thiểu 1 Credit để tham gia sau thời gian học thử.',
          );
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn('Could not verify wallet balance:', err);
        throw new ServiceUnavailableException(
          'Không thể kiểm tra số dư lúc này. Vui lòng thử lại sau.',
        );
      }
    }

    let participant = await this.participantRepo.findOne({
      where: { roomId: room.id, userId },
    });

    if (!participant) {
      participant = this.participantRepo.create({
        roomId: room.id,
        userId,
        role,
        joinedAt: new Date(),
        connectionStatus: ConnectionStatus.ONLINE,
        lastHeartbeatAt: new Date(),
      });
      await this.participantRepo.save(participant);
    } else {
      if (participant.isBlocked) {
        throw new ForbiddenException(
          participant.blockedReason
            ? `Bạn đã bị chủ phòng chặn vĩnh viễn khỏi phòng học này: ${participant.blockedReason}`
            : 'Bạn đã bị chủ phòng chặn vĩnh viễn khỏi phòng học này do vi phạm quy chế.',
        );
      }
      if (participant.isKicked) {
        throw new ForbiddenException('Bạn đã bị mời ra khỏi phòng học này.');
      }
      const now = new Date();
      // Nếu reconnect / F5 khi đang online, cộng dồn thời gian đã trôi qua chính xác
      if (participant.connectionStatus === ConnectionStatus.ONLINE && participant.joinedAt) {
        const lastAnchor = participant.lastHeartbeatAt || participant.joinedAt;
        const sessionElapsed = Math.max(
          0,
          Math.floor((now.getTime() - new Date(lastAnchor).getTime()) / 1000),
        );
        participant.activeSeconds =
          (participant.activeSeconds || 0) +
          Math.min(sessionElapsed, this.GROUP_HEARTBEAT_MAX_GAP_SECONDS);
      }
      participant.connectionStatus = ConnectionStatus.ONLINE;
      participant.joinedAt = now;
      participant.leftAt = null as any;
      participant.lastHeartbeatAt = now;
      await this.participantRepo.save(participant);
    }

    if (isMentor && room.hostDisconnectedAt) {
      room.hostDisconnectedAt = null;
      await this.roomRepo.save(room);
    }

    const { token, wsUrl } = await this.livekitService.generateToken({
      roomName: room.livekitRoomName,
      identity: userId,
      name: isMentor ? 'Mentor' : 'Học viên',
      role,
    });

    await this.recordConnectionEvent(room.id, participant.id, EventType.CONNECTED);

    const activeSeconds = participant.activeSeconds || 0;
    const freeSecondsRemaining = Math.max(0, this.GROUP_FREE_SECONDS - activeSeconds);
    const paidSeconds = Math.max(0, activeSeconds - this.GROUP_FREE_SECONDS);

    // Kiểm tra trạng thái hiện diện thực tế của Host và số giây đếm ngược hủy phòng còn lại
    const isHostPresent = await this.isHostPresentInGroupRoom(room);
    let hostAbsentSecondsRemaining = 300;
    if (!isHostPresent && !isMentor) {
      if (!room.hostDisconnectedAt) {
        room.hostDisconnectedAt = new Date();
        await this.roomRepo.save(room);
      }
      const elapsed = Math.floor(
        (Date.now() - new Date(room.hostDisconnectedAt!).getTime()) / 1000,
      );
      hostAbsentSecondsRemaining = Math.max(0, 300 - elapsed);
    }

    return {
      roomId: room.id,
      roomType: RoomType.GROUP,
      livekitRoomName: room.livekitRoomName,
      livekitToken: token,
      livekitWsUrl: wsUrl,
      status: room.status,
      role,
      mentorId: room.mentorId,
      availableBalance,
      canJoin: true,
      freeSecondsRemaining,
      activeSeconds,
      paidSeconds,
      creditsCharged: participant.creditCharged || 0,
      isHostPresent,
      hostDisconnectedAt: room.hostDisconnectedAt
        ? new Date(room.hostDisconnectedAt).toISOString()
        : null,
      hostAbsentSecondsRemaining,
    };
  }

  /**
   * POST /rooms/group/:roomId/leave — Learner rời phòng học nhóm
   */
  async leaveGroupRoom(
    userId: string,
    roomId: string,
  ): Promise<{
    roomId: string;
    leftAt: Date;
    minutesParticipated: number;
    creditsCharged: number;
    trialRefund: number;
  }> {
    const participant = await this.participantRepo.findOne({
      where: { roomId, userId },
    });

    if (!participant) {
      throw new NotFoundException('Không tìm thấy lượt tham gia của bạn trong phòng học.');
    }

    const leftAt = new Date();
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (
      room?.roomType === RoomType.GROUP &&
      participant.role === ParticipantRole.LEARNER &&
      participant.connectionStatus === ConnectionStatus.ONLINE
    ) {
      await this.settleGroupParticipantBillingOnExit(
        room,
        participant,
        leftAt,
      );
    } else {
      participant.leftAt = leftAt;
      participant.connectionStatus = ConnectionStatus.DISCONNECTED;
      participant.lastHeartbeatAt = null;
      await this.participantRepo.save(participant);
    }

    const minutesParticipated = Math.floor(
      (participant.activeSeconds || 0) / 60,
    );

    await this.recordConnectionEvent(roomId, participant.id, EventType.DISCONNECTED);

    if (room?.roomType === RoomType.GROUP && room.mentorId === userId) {
      room.hostDisconnectedAt = leftAt;
      await this.roomRepo.save(room);
    }

    return {
      roomId,
      leftAt,
      minutesParticipated,
      creditsCharged: participant.creditCharged || 0,
      trialRefund: 0,
    };
  }

  /**
   * POST /rooms/group/:roomId/close — Mentor (Host) đóng phòng học nhóm
   */
  async closeGroupRoom(userId: string, roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng học nhóm.');
    }

    if (room.mentorId !== userId) {
      throw new ForbiddenException('Chỉ chủ phòng (Mentor) mới có quyền đóng phòng học này.');
    }

    const activeLearners = await this.participantRepo.find({
      where: {
        roomId,
        role: ParticipantRole.LEARNER,
        connectionStatus: ConnectionStatus.ONLINE,
      },
    });
    const closedAt = new Date();
    for (const participant of activeLearners) {
      await this.settleGroupParticipantBillingOnExit(room, participant, closedAt);
    }

    // 1. Tính tổng số Credit đã trừ từ tất cả học viên trong phòng này
    const allLearners = await this.participantRepo.find({
      where: { roomId, role: ParticipantRole.LEARNER },
    });
    const totalPoolCredits = allLearners.reduce(
      (sum, l) => sum + (Number(l.creditCharged) || 0),
      0,
    );

    // 2. Giải phóng toàn bộ quỹ tạm giữ (Group Escrow) sang ví khả dụng của Mentor khi đóng phòng
    if (totalPoolCredits > 0) {
      try {
        await firstValueFrom(
          this.walletClient
            .send('wallet.releaseGroupEscrow', {
              roomId: room.id,
              mentorId: room.mentorId,
              amount: totalPoolCredits,
            })
            .pipe(timeout(8000)),
        );
        this.logger.log(
          `[closeGroupRoom] Successfully released ${totalPoolCredits} credits to mentor ${room.mentorId} for room ${room.id}`,
        );
      } catch (err) {
        this.logger.error(
          `[closeGroupRoom] Failed to release group escrow for room ${room.id}:`,
          err,
        );
      }
    }

    room.status = RoomStatus.COMPLETED;
    room.closedAt = closedAt;
    await this.roomRepo.save(room);

    this.logger.log(`[closeGroupRoom] Room ${roomId} closed by mentor ${userId}`);
    return {
      roomId,
      status: RoomStatus.COMPLETED,
      closedAt: room.closedAt,
      creditsTransferred: totalPoolCredits,
    };
  }

  /**
   * GET /rooms/group/:roomId/stats — Lấy thống kê quỹ tạm giữ & đóng góp của học viên
   */
  async getGroupRoomStats(userId: string, roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng học nhóm.');
    }

    const participants = await this.participantRepo.find({
      where: { roomId, role: ParticipantRole.LEARNER },
      order: { joinedAt: 'ASC' },
    });

    // Deduplicate learners by userId (bảo vệ trường hợp cùng 1 user có nhiều bản ghi tham gia phòng)
    const uniqueMap = new Map<string, RoomParticipant>();
    for (const p of participants) {
      if (!uniqueMap.has(p.userId)) {
        uniqueMap.set(p.userId, p);
      } else {
        const existing = uniqueMap.get(p.userId)!;
        existing.activeSeconds = Math.max(existing.activeSeconds || 0, p.activeSeconds || 0);
        existing.creditCharged = Math.max(existing.creditCharged || 0, p.creditCharged || 0);
        if (p.connectionStatus === ConnectionStatus.ONLINE) {
          existing.connectionStatus = ConnectionStatus.ONLINE;
          existing.lastHeartbeatAt = p.lastHeartbeatAt || existing.lastHeartbeatAt;
        }
      }
    }
    const dedupedParticipants = Array.from(uniqueMap.values());

    const now = new Date();
    const learners = dedupedParticipants.map((p) => {
      let activeSecs = p.activeSeconds || 0;
      if (p.connectionStatus === ConnectionStatus.ONLINE && p.lastHeartbeatAt) {
        const gap = Math.max(
          0,
          Math.floor((now.getTime() - new Date(p.lastHeartbeatAt).getTime()) / 1000),
        );
        activeSecs += Math.min(gap, this.GROUP_HEARTBEAT_MAX_GAP_SECONDS);
      }

      const freeRemaining = Math.max(0, this.GROUP_FREE_SECONDS - activeSecs);
      const paidSecs = Math.max(0, activeSecs - this.GROUP_FREE_SECONDS);
      const paidMins = Math.floor(paidSecs / 60);
      const credits = Math.max(p.creditCharged || 0, paidMins);

      return {
        id: p.id,
        userId: p.userId,
        role: p.role,
        connectionStatus: p.connectionStatus,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        activeSeconds: activeSecs,
        freeSecondsRemaining: freeRemaining,
        paidMinutes: paidMins,
        creditsContributed: credits,
      };
    });

    const totalPoolCredits = learners.reduce((sum, l) => sum + l.creditsContributed, 0);

    return {
      roomId: room.id,
      title: room.title,
      mentorId: room.mentorId,
      status: room.status,
      openedAt: room.openedAt || new Date(),
      accumulatedCredits: totalPoolCredits,
      totalLearnersCount: learners.length,
      activeLearnersCount: learners.filter(
        (l) => l.connectionStatus === ConnectionStatus.ONLINE,
      ).length,
      learners,
    };
  }

  /**
   * GET /rooms/group/active — Lấy danh sách các phòng học nhóm đang mở
   */
  async getActiveGroupRooms(query: GetActiveGroupRoomsQueryDto) {
    const qb = this.roomRepo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.participants', 'participant')
      .where('room.roomType = :type', { type: RoomType.GROUP })
      .andWhere('room.status = :status', { status: RoomStatus.IN_PROGRESS });

    if (query.category) {
      qb.andWhere('room.category = :category', { category: query.category });
    }

    qb.orderBy('room.openedAt', 'DESC');

    const limit = query.limit || 20;
    const page = query.page || 1;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const enriched = items.map((r) => {
      const activeCount = (r.participants || []).filter(
        (p) => p.connectionStatus === ConnectionStatus.ONLINE,
      ).length;
      const participantUserIds = (r.participants || []).map((p) => p.userId);
      return {
        roomId: r.id,
        mentorId: r.mentorId,
        title: r.title || 'Phòng học nhóm trực tuyến',
        category: r.category,
        skills: r.skills || [],
        coverImage: r.coverImage,
        maxParticipants: r.maxParticipants || 20,
        postId: r.postId,
        currentParticipants: activeCount,
        participantUserIds,
        openedAt: r.openedAt,
        status: r.status,
      };
    });

    return {
      rooms: enriched,
      total,
      page,
      limit,
    };
  }

  /**
   * GET /rooms/group/history — Lấy danh sách lịch sử các phòng học nhóm đã kết thúc
   */
  async getGroupRoomsHistory(userId: string, query?: any) {
    const qb = this.roomRepo
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.participants', 'participant')
      .where('room.roomType = :type', { type: RoomType.GROUP })
      .andWhere('room.status = :status', { status: RoomStatus.COMPLETED })
      .andWhere(
        '(room.mentorId = :userId OR EXISTS (SELECT 1 FROM room_participant rp WHERE rp.room_id = room.id AND rp.user_id = :userId))',
        { userId },
      )
      .orderBy('room.closedAt', 'DESC');

    const limit = query?.limit || 20;
    const page = query?.page || 1;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const enriched = items.map((r) => {
      const participants = r.participants || [];
      const uniqueUserIds = new Set(participants.map((p) => p.userId));
      const totalParticipants = uniqueUserIds.size || 1;

      const durationMinutes =
        r.openedAt && r.closedAt
          ? Math.max(1, Math.round((new Date(r.closedAt).getTime() - new Date(r.openedAt).getTime()) / (60 * 1000)))
          : 0;

      const isHost = r.mentorId === userId;
      const myParticipant = participants.find((p) => p.userId === userId);

      const myActiveSeconds = myParticipant?.activeSeconds || 0;
      const myDurationMinutes =
        myActiveSeconds > 0
          ? Math.max(1, Math.round(myActiveSeconds / 60))
          : durationMinutes;
      const myCreditCharged = myParticipant?.creditCharged || 0;

      const totalCreditsEarned = participants
        .filter((p) => p.role === ParticipantRole.LEARNER)
        .reduce((sum, p) => sum + (p.creditCharged || 0), 0);

      return {
        roomId: r.id,
        mentorId: r.mentorId,
        title: r.title || 'Phòng học nhóm trực tuyến',
        category: r.category,
        coverImage: r.coverImage,
        skills: r.skills || [],
        maxParticipants: r.maxParticipants || 20,
        postId: r.postId,
        totalParticipants,
        openedAt: r.openedAt,
        closedAt: r.closedAt,
        durationMinutes,
        myDurationMinutes,
        myActiveSeconds,
        myCreditCharged,
        totalCreditsEarned,
        status: r.status,
        isHost,
      };
    });

    return {
      rooms: enriched,
      total,
      page,
      limit,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // 3. QUẢN LÝ PHÒNG & MODERATION (HOST ACTIONS)
  // ════════════════════════════════════════════════════════════════

  /**
   * POST /rooms/:roomId/mute/:participantId — Host tắt mic người tham gia
   */
  async muteParticipant(
    hostId: string,
    roomId: string,
    participantId: string,
    isMuted = true,
  ) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Không tìm thấy phòng học.');
    if (room.mentorId !== hostId) {
      throw new ForbiddenException('Chỉ Mentor mới có quyền quản lý âm thanh của người học.');
    }

    const participant = await this.participantRepo.findOne({
      where: [
        { id: participantId, roomId },
        { userId: participantId, roomId },
      ],
    });
    if (!participant) throw new NotFoundException('Không tìm thấy người tham gia.');

    participant.isMuted = isMuted;
    await this.participantRepo.save(participant);

    const action = this.hostActionRepo.create({
      roomId,
      actorId: hostId,
      targetUserId: participant.userId,
      actionType: isMuted ? LocalHostActionType.MUTE : LocalHostActionType.UNMUTE,
      reason: isMuted ? 'Host tắt mic người tham gia' : 'Host mở mic người tham gia',
    });
    await this.hostActionRepo.save(action);

    return {
      participantId: participant.id,
      userId: participant.userId,
      isMuted: participant.isMuted,
    };
  }

  /**
   * POST /rooms/:roomId/kick/:participantId — Host mời người tham gia ra khỏi phòng
   */
  async kickParticipant(
    hostId: string,
    roomId: string,
    participantId: string,
    reason?: string,
  ) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Không tìm thấy phòng học.');
    if (room.mentorId !== hostId) {
      throw new ForbiddenException('Chỉ Mentor mới có quyền mời người học ra khỏi phòng.');
    }

    const participant = await this.participantRepo.findOne({
      where: [
        { id: participantId, roomId },
        { userId: participantId, roomId },
      ],
    });
    if (!participant) throw new NotFoundException('Không tìm thấy người tham gia.');

    if (
      room.roomType === RoomType.GROUP &&
      participant.role === ParticipantRole.LEARNER &&
      participant.connectionStatus === ConnectionStatus.ONLINE
    ) {
      await this.settleGroupParticipantBillingOnExit(room, participant, new Date());
    } else {
      participant.leftAt = new Date();
      participant.lastHeartbeatAt = null;
    }

    participant.isKicked = true;
    participant.connectionStatus = ConnectionStatus.KICKED;
    await this.participantRepo.save(participant);

    // Ngắt kết nối LiveKit WebRTC của người bị kick ngay lập tức
    if (room.livekitRoomName) {
      try {
        await this.livekitService.removeParticipant(room.livekitRoomName, participant.userId);
      } catch (e: any) {
        this.logger.warn(`Không thể ngắt LiveKit của participant ${participant.userId}: ${e?.message}`);
      }
    }

    const action = this.hostActionRepo.create({
      roomId,
      actorId: hostId,
      targetUserId: participant.userId,
      actionType: LocalHostActionType.KICK,
      reason: reason || 'Vi phạm quy định phòng học',
    });
    await this.hostActionRepo.save(action);

    await this.recordConnectionEvent(roomId, participant.id, EventType.DISCONNECTED);

    return {
      participantId: participant.id,
      userId: participant.userId,
      isKicked: true,
      creditsCharged: participant.creditCharged || 0,
    };
  }

  /**
   * POST /rooms/:roomId/block/:participantId — Host cấm người tham gia vĩnh viễn khỏi phòng
   */
  async blockParticipant(
    hostId: string,
    roomId: string,
    participantId: string,
    reason?: string,
  ) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Không tìm thấy phòng học.');
    if (room.mentorId !== hostId) {
      throw new ForbiddenException('Chỉ Mentor mới có quyền chặn người học khỏi phòng.');
    }

    const participant = await this.participantRepo.findOne({
      where: [
        { id: participantId, roomId },
        { userId: participantId, roomId },
      ],
    });
    if (!participant) throw new NotFoundException('Không tìm thấy người tham gia.');

    if (
      room.roomType === RoomType.GROUP &&
      participant.role === ParticipantRole.LEARNER &&
      participant.connectionStatus === ConnectionStatus.ONLINE
    ) {
      await this.settleGroupParticipantBillingOnExit(room, participant, new Date());
    } else {
      participant.leftAt = new Date();
      participant.lastHeartbeatAt = null;
    }

    participant.isKicked = true;
    participant.isBlocked = true;
    participant.blockedReason = reason || 'Vi phạm quy định phòng học';
    participant.connectionStatus = ConnectionStatus.KICKED;
    await this.participantRepo.save(participant);

    // Ngắt kết nối LiveKit WebRTC của người bị block ngay lập tức
    if (room.livekitRoomName) {
      try {
        await this.livekitService.removeParticipant(room.livekitRoomName, participant.userId);
      } catch (e: any) {
        this.logger.warn(`Không thể ngắt LiveKit của participant ${participant.userId}: ${e?.message}`);
      }
    }

    const action = this.hostActionRepo.create({
      roomId,
      actorId: hostId,
      targetUserId: participant.userId,
      actionType: LocalHostActionType.BLOCK,
      reason: reason || 'Vi phạm quy chế phòng học (Bị chặn)',
    });
    await this.hostActionRepo.save(action);

    await this.recordConnectionEvent(roomId, participant.id, EventType.DISCONNECTED);

    return {
      participantId: participant.id,
      userId: participant.userId,
      isKicked: true,
      isBlocked: true,
      reason: participant.blockedReason,
      creditsCharged: participant.creditCharged || 0,
      activeSeconds: participant.activeSeconds || 0,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // 4. HEARTBEAT TICK & TRỪ CREDIT CHU KỲ (60 GIÂY)
  // ════════════════════════════════════════════════════════════════

  /**
   * SOCKET / RMQ: heartbeat — Ghi nhận nhịp tim & Tích lũy thời gian học (Chỉ trừ ví khi thoát phòng)
   */
  async processHeartbeat(userId: string, roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room || room.status !== RoomStatus.IN_PROGRESS) {
      return { success: false, reason: 'Room not active' };
    }

    const participant = await this.participantRepo.findOne({
      where: { roomId, userId },
    });
    if (
      !participant ||
      participant.isKicked ||
      participant.connectionStatus !== ConnectionStatus.ONLINE
    ) {
      return { success: false, reason: 'Participant not in room or kicked' };
    }

    const now = new Date();

    // Nếu người gửi heartbeat là Host (Mentor) của phòng học nhóm
    if (room.roomType === RoomType.GROUP && room.mentorId === userId) {
      participant.lastHeartbeatAt = now;
      await this.participantRepo.save(participant);
      if (room.hostDisconnectedAt) {
        room.hostDisconnectedAt = null;
        await this.roomRepo.save(room);
      }
      return {
        success: true,
        isHost: true,
        lastHeartbeatAt: now,
      };
    }

    // Nếu người gửi là Learner trong phòng nhóm: kiểm tra xem Host có đang hiện diện không
    if (room.roomType === RoomType.GROUP && participant.role === ParticipantRole.LEARNER) {
      const isHostPresent = await this.isHostPresentInGroupRoom(room);
      if (!isHostPresent) {
        // Chủ phòng vắng mặt: ĐÓNG BĂNG thời gian và credit, không tích lũy giây
        participant.lastHeartbeatAt = now;
        await this.participantRepo.save(participant);
        return {
          tickId: null,
          isFrozen: true,
          creditDeducted: 0,
          newBalance: undefined,
          insufficientBalance: false,
          freeSecondsRemaining: Math.max(
            0,
            this.GROUP_FREE_SECONDS - (participant.activeSeconds || 0),
          ),
          totalCreditsCharged: participant.creditCharged || 0,
        };
      }
    }

    // Tích lũy số giây học thực tế
    let elapsedSeconds = 0;
    if (participant.lastHeartbeatAt) {
      elapsedSeconds = Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(participant.lastHeartbeatAt).getTime()) / 1000,
        ),
      );
    }
    participant.lastHeartbeatAt = now;
    participant.activeSeconds =
      (participant.activeSeconds || 0) +
      Math.min(elapsedSeconds, this.GROUP_HEARTBEAT_MAX_GAP_SECONDS);

    const completedBillableMinutes = Math.floor(
      Math.max(0, (participant.activeSeconds || 0) - this.GROUP_FREE_SECONDS) / 60,
    );

    // Kiểm tra số dư ví khả dụng của Learner
    let insufficientBalance = false;
    try {
      const walletRes = await firstValueFrom(
        this.walletClient
          .send('wallet.getWallet', { userId: participant.userId })
          .pipe(timeout(3000)),
      );
      const availableBalance = walletRes?.availableBalance ?? 0;
      if (availableBalance < completedBillableMinutes && completedBillableMinutes > 0) {
        insufficientBalance = true;
      }
    } catch {
      // Fail-soft nếu service wallet phản hồi chậm
    }

    if (insufficientBalance) {
      participant.connectionStatus = ConnectionStatus.DISCONNECTED;
      participant.leftAt = now;
      participant.lastHeartbeatAt = null;
      await this.participantRepo.save(participant);
      await this.livekitService.removeParticipant(
        room.livekitRoomName,
        participant.userId,
      );
    } else {
      await this.participantRepo.save(participant);
    }

    const tick = this.heartbeatRepo.create({
      participantId: participant.id,
      roomId,
      tickAt: now,
      creditDeducted: false,
      emittedAt: now,
    });
    await this.heartbeatRepo.save(tick);

    return {
      tickId: tick.id,
      creditDeducted: 0,
      newBalance: undefined,
      insufficientBalance,
      freeSecondsRemaining: Math.max(
        0,
        this.GROUP_FREE_SECONDS - (participant.activeSeconds || 0),
      ),
      totalCreditsCharged: completedBillableMinutes,
      isFrozen: false,
    };
  }

  /**
   * Đồng bộ hóa số giây học thực tế từ client
   */
  async syncGroupMetering(
    userId: string,
    roomId: string,
    activeSeconds: number,
  ) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room || room.roomType !== RoomType.GROUP) return { success: false };

    const participant = await this.participantRepo.findOne({
      where: { roomId, userId },
    });
    if (!participant || participant.role !== ParticipantRole.LEARNER) {
      return { success: false };
    }

    // Kiểm tra xem Chủ phòng có mặt không
    const isHostPresent = await this.isHostPresentInGroupRoom(room);
    if (!isHostPresent) {
      return {
        success: true,
        isFrozen: true,
        activeSeconds: participant.activeSeconds || 0,
        creditDeducted: 0,
        newBalance: undefined,
        insufficientBalance: false,
      };
    }

    if (activeSeconds > (participant.activeSeconds || 0)) {
      participant.activeSeconds = activeSeconds;
    }
    const now = new Date();
    participant.lastHeartbeatAt = now;
    await this.participantRepo.save(participant);

    const completedBillableMinutes = Math.floor(
      Math.max(0, (participant.activeSeconds || 0) - this.GROUP_FREE_SECONDS) / 60,
    );

    return {
      success: true,
      activeSeconds: participant.activeSeconds,
      creditDeducted: 0,
      newBalance: undefined,
      insufficientBalance: false,
      totalCreditsCharged: completedBillableMinutes,
    };
  }

  /**
   * Quyết toán 01 lần duy nhất toàn bộ số phút trả phí khi Learner rời phòng
   */
  private async settleGroupParticipantBillingOnExit(
    room: RoomSession,
    participant: RoomParticipant,
    now: Date,
  ): Promise<{
    creditsCharged: number;
    balanceAfter?: number;
  }> {
    if (!participant || participant.role !== ParticipantRole.LEARNER) {
      return { creditsCharged: 0 };
    }

    const totalBillableMinutes = Math.floor(
      Math.max(0, (participant.activeSeconds || 0) - this.GROUP_FREE_SECONDS) / 60,
    );
    const alreadyCharged = participant.creditCharged || 0;
    const creditsToCharge = Math.max(0, totalBillableMinutes - alreadyCharged);

    let balanceAfter: number | undefined;

    if (creditsToCharge > 0) {
      try {
        const deductResult = await firstValueFrom(
          this.walletClient
            .send('credit.deduct', {
              roomId: room.id,
              learnerId: participant.userId,
              mentorId: room.mentorId,
              amount: creditsToCharge,
              chargeKey: `group_exit:${room.id}:${participant.id}:${totalBillableMinutes}`,
              minuteIndex: totalBillableMinutes,
            })
            .pipe(timeout(8000)),
        );
        balanceAfter = deductResult?.balanceAfter;
        participant.chargedMinutes = totalBillableMinutes;
        participant.creditCharged = totalBillableMinutes;
        this.logger.log(
          `[settleGroupExit] Successfully deducted ${creditsToCharge} credits for learner ${participant.userId} in room ${room.id}`,
        );
      } catch (err) {
        this.logger.error(
          `[settleGroupExit] Failed to deduct ${creditsToCharge} credits for learner ${participant.userId} in room ${room.id}:`,
          err,
        );
      }
    }

    participant.leftAt = now;
    participant.connectionStatus = ConnectionStatus.DISCONNECTED;
    participant.lastHeartbeatAt = null;
    await this.participantRepo.save(participant);

    return {
      creditsCharged: participant.creditCharged || 0,
      balanceAfter,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // 5. CHAT TRONG PHÒNG HỌC (IN-ROOM REALTIME CHAT)
  // ════════════════════════════════════════════════════════════════

  /**
   * Gửi tin nhắn trao đổi trong phòng học
   */
  async sendRoomChatMessage(
    userId: string,
    roomId: string,
    content?: string,
    attachmentUrl?: string,
    attachmentName?: string,
    attachmentPublicId?: string,
    attachmentResourceType?: 'image' | 'raw' | 'video',
  ) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Không tìm thấy phòng học.');
    await this.assertRoomParticipant(userId, roomId);

    let verifiedAttachmentUrl: string | undefined;
    if (attachmentUrl || attachmentPublicId) {
      if (!room.bookingId || !attachmentPublicId || !attachmentResourceType) {
        throw new BadRequestException('Thiếu metadata xác minh direct upload');
      }
      const asset = await this.cloudinaryService.verifyDirectUpload({
        publicId: attachmentPublicId,
        resourceType: attachmentResourceType,
        expectedPublicIdPrefix: `unitimebank/chat-attachments/${room.bookingId}/${userId}_`,
        maxBytes: 10 * 1024 * 1024,
        allowedFormats:
          attachmentResourceType === 'image'
            ? ['jpg', 'jpeg', 'png', 'webp', 'gif']
            : undefined,
      });
      verifiedAttachmentUrl = asset.url;
    }

    const message = this.chatMessageRepo.create({
      roomId,
      senderId: userId,
      content: content || '',
      attachmentUrl: verifiedAttachmentUrl,
      attachmentName,
      sentAt: new Date(),
    });
    const saved = await this.chatMessageRepo.save(message);

    return saved;
  }

  /**
   * Lấy lịch sử chat trong phòng học
   */
  async getRoomChatMessages(userId: string, roomId: string) {
    await this.assertRoomParticipant(userId, roomId);
    return this.chatMessageRepo.find({
      where: { roomId },
      order: { sentAt: 'ASC' },
      take: 100,
    });
  }

  private async assertRoomParticipant(userId: string, roomId: string) {
    const participant = await this.participantRepo.findOne({ where: { roomId, userId } });
    if (!participant || participant.isKicked) {
      throw new ForbiddenException('Bạn không có quyền truy cập chat của phòng học này.');
    }
    return participant;
  }

  // ════════════════════════════════════════════════════════════════
  // 6. GHI HÌNH BUỔI HỌC (SCREEN RECORDING)
  // ════════════════════════════════════════════════════════════════

  /**
   * Bắt đầu ghi hình buổi học
   */
  async startRecording(userId: string, roomId: string) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Không tìm thấy phòng học.');

    const recording = this.recordingRepo.create({
      roomId,
      recorderId: userId,
      status: RecordingStatus.RECORDING,
      startedAt: new Date(),
      sizeBytes: 0,
    });
    const saved = await this.recordingRepo.save(recording);

    return {
      recordingId: saved.id,
      status: saved.status,
      startedAt: saved.startedAt,
      maxSizeBytes: 104857600, // 100MB
    };
  }

  /**
   * Kết thúc ghi hình & Upload Cloudinary
   */
  async stopRecording(userId: string, roomId: string, file?: Express.Multer.File) {
    let recording = await this.recordingRepo.findOne({
      where: { roomId, recorderId: userId, status: RecordingStatus.RECORDING },
      order: { startedAt: 'DESC' },
    });

    if (!recording) {
      recording = this.recordingRepo.create({
        roomId,
        recorderId: userId,
        status: RecordingStatus.RECORDING,
        startedAt: new Date(),
      });
    }

    let publicId = 'recordings/mock_recording';
    let sizeBytes = 0;

    if (file) {
      sizeBytes = file.size;
      const uploadRes = await this.cloudinaryService.uploadAttachment(
        file.buffer,
        file.originalname || 'session-recording.webm',
        file.mimetype || 'video/webm',
        'unitimebank/recordings',
      );
      publicId = uploadRes.url;
    }

    recording.status = RecordingStatus.UPLOADED;
    recording.endedAt = new Date();
    recording.cloudinaryPublicId = publicId;
    recording.sizeBytes = sizeBytes;
    const saved = await this.recordingRepo.save(recording);

    return {
      recordingId: saved.id,
      status: saved.status,
      cloudinaryPublicId: saved.cloudinaryPublicId,
      sizeBytes: saved.sizeBytes,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // 7. HELPER METHODS
  // ════════════════════════════════════════════════════════════════

  private async getBookingById(bookingId: string): Promise<any | null> {
    try {
      this.logger.log(`[getBookingById] Querying booking ${bookingId} over RMQ...`);
      const booking = await firstValueFrom(
        this.bookingClient.send('booking.findById', { id: bookingId }).pipe(timeout(5000)),
      );
      this.logger.log(
        `[getBookingById] Querying booking ${bookingId} result: ${JSON.stringify(
          booking
            ? {
                id: booking.id,
                mentorId: booking.mentorId,
                learnerId: booking.learnerId,
                status: booking.status,
              }
            : null,
        )}`,
      );
      return booking;
    } catch (err) {
      this.logger.error(`Error querying booking ${bookingId} over RMQ:`, err);
      return null;
    }
  }

  private async recordConnectionEvent(
    roomId: string,
    participantId: string,
    eventType: EventType,
  ) {
    try {
      const event = this.connectionEventRepo.create({
        roomId,
        participantId,
        eventType,
      });
      await this.connectionEventRepo.save(event);
    } catch (err) {
      this.logger.warn('Failed to record connection event:', err);
    }
  }

  /**
   * Tự động hủy phòng học nhóm khi Host vắng mặt từ 5 phút (300s) trở lên
   */
  async killGroupRoomDueToHostAbsence(room: RoomSession) {
    this.logger.warn(
      `[killGroupRoomDueToHostAbsence] Đang tự động đóng phòng ${room.id} do chủ phòng vắng mặt quá 5 phút`,
    );
    const closedAt = new Date();

    // 1. Cập nhật các học viên còn lại về DISCONNECTED
    const activeLearners = await this.participantRepo.find({
      where: {
        roomId: room.id,
        role: ParticipantRole.LEARNER,
        connectionStatus: ConnectionStatus.ONLINE,
      },
    });
    for (const participant of activeLearners) {
      participant.connectionStatus = ConnectionStatus.DISCONNECTED;
      participant.leftAt = closedAt;
      participant.lastHeartbeatAt = null;
      await this.participantRepo.save(participant);
      await this.recordConnectionEvent(room.id, participant.id, EventType.DISCONNECTED);
    }

    // 2. Giải phóng số credit hợp lệ đã trừ từ trước khi Host vắng mặt sang ví Host (nếu có)
    const allLearners = await this.participantRepo.find({
      where: { roomId: room.id, role: ParticipantRole.LEARNER },
    });
    const totalPoolCredits = allLearners.reduce(
      (sum, l) => sum + (Number(l.creditCharged) || 0),
      0,
    );

    if (totalPoolCredits > 0) {
      try {
        await firstValueFrom(
          this.walletClient
            .send('wallet.releaseGroupEscrow', {
              roomId: room.id,
              mentorId: room.mentorId,
              amount: totalPoolCredits,
            })
            .pipe(timeout(8000)),
        );
        this.logger.log(
          `[killGroupRoomDueToHostAbsence] Đã giải phóng ${totalPoolCredits} credits cho mentor ${room.mentorId} của phòng ${room.id}`,
        );
      } catch (err) {
        this.logger.error(
          `[killGroupRoomDueToHostAbsence] Lỗi giải ngân escrow cho phòng ${room.id}:`,
          err,
        );
      }
    }

    // 3. Đóng phòng và lưu lý do HOST_ABSENT_TIMEOUT
    room.status = RoomStatus.COMPLETED;
    room.closedAt = closedAt;
    room.closeReason = RoomCloseReason.HOST_ABSENT_TIMEOUT;
    await this.roomRepo.save(room);

    // 4. Giải phóng phòng LiveKit để ngắt toàn bộ kết nối WebRTC ngay lập tức
    if (room.livekitRoomName) {
      await this.livekitService.deleteRoom(room.livekitRoomName);
    }

    // 5. Bắn thông báo hệ thống qua notification service cho Host
    try {
      this.notificationClient.emit(NOTIFICATION_EVENTS.CREATE, {
        userId: room.mentorId,
        title: 'Phòng học nhóm đã đóng',
        content: 'Phòng học nhóm của bạn đã tự động kết thúc do bạn vắng mặt quá 5 phút.',
        type: 'SYSTEM',
        referenceId: room.id,
      });
    } catch (nErr) {
      this.logger.warn('Failed to emit notification for killed room:', nErr);
    }

    return {
      roomId: room.id,
      status: RoomStatus.COMPLETED,
      closeReason: RoomCloseReason.HOST_ABSENT_TIMEOUT,
      closedAt,
    };
  }

  // ════════════════════════════════════════════════════════════════
  // 8. CRON JOB: AUTOMATED SESSION LIFECYCLE (OPEN, CLOSE & KILL)
  // ════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleAutomatedSessionLifecycle() {
    const now = new Date();

    // 1. Tự động kết thúc phòng học 1:1 đã hết giờ theo lịch (scheduledEnd)
    try {
      const activeRooms = await this.roomRepo.find({
        where: {
          status: RoomStatus.IN_PROGRESS,
          roomType: RoomType.ONE_ON_ONE,
        },
      });

      for (const room of activeRooms) {
        if (!room.bookingId) continue;
        const booking = await this.getBookingById(room.bookingId);
        if (booking && booking.scheduledEnd) {
          const endTime = new Date(booking.scheduledEnd);
          if (now >= endTime) {
            this.logger.log(
              `Auto-closing room ${room.id} for booking ${booking.id} (Scheduled end reached)`,
            );

            // Mark room completed
            room.status = RoomStatus.COMPLETED;
            room.closedAt = now;
            room.closeReason = RoomCloseReason.TIME_ELAPSED;
            await this.roomRepo.save(room);

            // 1. Update booking status
            this.bookingClient.emit('booking.updateStatus', {
              id: booking.id,
              status: 'COMPLETED',
            });

            // 2. Release escrow to mentor
            const creditsToTransfer = booking.totalCreditEscrowed || 0;
            this.walletClient.emit('wallet.releaseEscrow', {
              roomId: room.id,
              bookingId: booking.id,
              learnerId: booking.learnerId,
              mentorId: booking.mentorId,
              creditsTransferred: creditsToTransfer,
            });

            // 3. Mark active participants disconnected
            try {
              const activeParticipants = await this.participantRepo.find({
                where: { roomId: room.id, connectionStatus: ConnectionStatus.ONLINE },
              });
              for (const p of activeParticipants) {
                p.leftAt = now;
                p.connectionStatus = ConnectionStatus.DISCONNECTED;
                await this.participantRepo.save(p);
                await this.recordConnectionEvent(room.id, p.id, EventType.DISCONNECTED);
              }
            } catch (pErr) {
              this.logger.warn('Failed to update participants on auto-close:', pErr);
            }
          }
        }
      }
    } catch (err) {
      this.logger.error('Error in auto-close session cron:', err);
    }

    // 2. Tự động kiểm tra và kill phòng học nhóm nếu Host vắng mặt >= 5 phút (300 giây)
    try {
      const activeGroupRooms = await this.roomRepo.find({
        where: {
          status: RoomStatus.IN_PROGRESS,
          roomType: RoomType.GROUP,
        },
      });

      for (const room of activeGroupRooms) {
        const isHostPresent = await this.isHostPresentInGroupRoom(room);
        if (!isHostPresent) {
          if (!room.hostDisconnectedAt) {
            const hostParticipant = await this.participantRepo.findOne({
              where: { roomId: room.id, userId: room.mentorId },
            });
            room.hostDisconnectedAt =
              hostParticipant?.leftAt || hostParticipant?.lastHeartbeatAt || now;
            await this.roomRepo.save(room);
          }

          const absentSeconds =
            (now.getTime() - new Date(room.hostDisconnectedAt).getTime()) / 1000;

          if (absentSeconds >= 300) {
            await this.killGroupRoomDueToHostAbsence(room);
          }
        } else {
          if (room.hostDisconnectedAt) {
            room.hostDisconnectedAt = null;
            await this.roomRepo.save(room);
          }
        }
      }
    } catch (gErr) {
      this.logger.error('Error in group room auto-kill cron:', gErr);
    }
  }

  /**
   * Kiểm tra xem user có đang tham gia một phòng học nhóm ONLINE đang diễn ra hay không
   */
  async isUserInActiveGroupRoom(userId: string): Promise<boolean> {
    if (!userId) return false;
    const participant = await this.participantRepo
      .createQueryBuilder('p')
      .innerJoin('p.roomSession', 'r')
      .where('p.userId = :userId', { userId })
      .andWhere('p.connectionStatus = :status', { status: ConnectionStatus.ONLINE })
      .andWhere('r.roomType = :roomType', { roomType: RoomType.GROUP })
      .andWhere('r.status = :roomStatus', { roomStatus: RoomStatus.IN_PROGRESS })
      .getOne();

    return Boolean(participant);
  }
}
