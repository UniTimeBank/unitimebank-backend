import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
  ServiceUnavailableException,
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
export class SessionService {
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
      });
      await this.participantRepo.save(participant);
    } else {
      if (participant.isKicked) {
        throw new ForbiddenException('Bạn đã bị mời ra khỏi phòng học này.');
      }
      participant.connectionStatus = ConnectionStatus.ONLINE;
      participant.joinedAt = new Date();
      participant.leftAt = null as any;
      participant.lastHeartbeatAt = null;
      await this.participantRepo.save(participant);
    }

    const { token, wsUrl } = await this.livekitService.generateToken({
      roomName: room.livekitRoomName,
      identity: userId,
      name: isMentor ? 'Mentor' : 'Học viên',
      role,
    });

    await this.recordConnectionEvent(room.id, participant.id, EventType.CONNECTED);

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
      await this.settleGroupParticipantBilling(
        room,
        participant,
        leftAt,
      );
    }
    participant.leftAt = leftAt;
    participant.connectionStatus = ConnectionStatus.DISCONNECTED;
    participant.lastHeartbeatAt = null;

    const minutesParticipated = Math.floor(
      (participant.activeSeconds || 0) / 60,
    );

    await this.participantRepo.save(participant);
    await this.recordConnectionEvent(roomId, participant.id, EventType.DISCONNECTED);

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
      await this.settleGroupParticipantBilling(room, participant, closedAt);
      participant.connectionStatus = ConnectionStatus.DISCONNECTED;
      participant.leftAt = closedAt;
      participant.lastHeartbeatAt = null;
      await this.participantRepo.save(participant);
    }

    room.status = RoomStatus.COMPLETED;
    room.closedAt = closedAt;
    await this.roomRepo.save(room);

    this.logger.log(`[closeGroupRoom] Room ${roomId} closed by mentor ${userId}`);
    return {
      roomId,
      status: RoomStatus.COMPLETED,
      closedAt: room.closedAt,
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
      .andWhere('(room.mentorId = :userId OR participant.userId = :userId)', { userId })
      .orderBy('room.closedAt', 'DESC');

    const limit = query?.limit || 20;
    const page = query?.page || 1;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const enriched = items.map((r) => {
      const totalParticipants = (r.participants || []).length;
      const durationMinutes = r.openedAt && r.closedAt
        ? Math.max(1, Math.round((new Date(r.closedAt).getTime() - new Date(r.openedAt).getTime()) / (60 * 1000)))
        : 0;

      return {
        roomId: r.id,
        mentorId: r.mentorId,
        title: r.title || 'Phòng học nhóm trực tuyến',
        category: r.category,
        maxParticipants: r.maxParticipants || 20,
        postId: r.postId,
        totalParticipants,
        openedAt: r.openedAt,
        closedAt: r.closedAt,
        durationMinutes,
        status: r.status,
        isHost: r.mentorId === userId,
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
      where: { id: participantId, roomId },
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
      where: { id: participantId, roomId },
    });
    if (!participant) throw new NotFoundException('Không tìm thấy người tham gia.');

    if (
      room.roomType === RoomType.GROUP &&
      participant.role === ParticipantRole.LEARNER &&
      participant.connectionStatus === ConnectionStatus.ONLINE
    ) {
      await this.settleGroupParticipantBilling(room, participant, new Date());
    }

    participant.isKicked = true;
    participant.connectionStatus = ConnectionStatus.KICKED;
    participant.leftAt = new Date();
    participant.lastHeartbeatAt = null;
    await this.participantRepo.save(participant);

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

  // ════════════════════════════════════════════════════════════════
  // 4. HEARTBEAT TICK & TRỪ CREDIT CHU KỲ (60 GIÂY)
  // ════════════════════════════════════════════════════════════════

  /**
   * SOCKET / RMQ: heartbeat — Ghi nhận nhịp tim & Trừ 1 Credit cho lớp nhóm
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

    let billingResult: {
      creditDeducted: number;
      newBalance?: number;
      insufficientBalance: boolean;
    } = {
      creditDeducted: 0,
      insufficientBalance: false,
    };

    if (room.roomType === RoomType.GROUP && participant.role === ParticipantRole.LEARNER) {
      billingResult = await this.settleGroupParticipantBilling(
        room,
        participant,
        new Date(),
      );
    }

    const tick = this.heartbeatRepo.create({
      participantId: participant.id,
      roomId,
      tickAt: new Date(),
      creditDeducted: billingResult.creditDeducted > 0,
      emittedAt: new Date(),
    });
    await this.heartbeatRepo.save(tick);

    return {
      tickId: tick.id,
      creditDeducted: billingResult.creditDeducted,
      newBalance: billingResult.newBalance,
      insufficientBalance: billingResult.insufficientBalance,
      freeSecondsRemaining: Math.max(
        0,
        this.GROUP_FREE_SECONDS - (participant.activeSeconds || 0),
      ),
      totalCreditsCharged: participant.creditCharged || 0,
    };
  }

  private async settleGroupParticipantBilling(
    room: RoomSession,
    participant: RoomParticipant,
    now: Date,
  ): Promise<{
    creditDeducted: number;
    newBalance?: number;
    insufficientBalance: boolean;
  }> {
    if (!participant.lastHeartbeatAt) {
      participant.lastHeartbeatAt = now;
      await this.participantRepo.save(participant);
      return { creditDeducted: 0, insufficientBalance: false };
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor(
        (now.getTime() - new Date(participant.lastHeartbeatAt).getTime()) / 1000,
      ),
    );
    participant.lastHeartbeatAt = now;
    participant.activeSeconds =
      (participant.activeSeconds || 0) +
      Math.min(elapsedSeconds, this.GROUP_HEARTBEAT_MAX_GAP_SECONDS);

    const completedBillableMinutes = Math.floor(
      Math.max(0, participant.activeSeconds - this.GROUP_FREE_SECONDS) / 60,
    );
    let creditDeducted = 0;
    let newBalance: number | undefined;
    let insufficientBalance = false;

    for (
      let minuteIndex = (participant.chargedMinutes || 0) + 1;
      minuteIndex <= completedBillableMinutes;
      minuteIndex += 1
    ) {
      try {
        const deductResult = await firstValueFrom(
          this.walletClient
            .send('credit.deduct', {
              roomId: room.id,
              learnerId: participant.userId,
              mentorId: room.mentorId,
              amount: 1,
              chargeKey: `group:${room.id}:${participant.id}:${minuteIndex}`,
              minuteIndex,
            })
            .pipe(timeout(5000)),
        );
        newBalance = deductResult?.balanceAfter;
        if (!deductResult?.success) {
          insufficientBalance =
            deductResult?.reason === 'INSUFFICIENT_BALANCE';
          break;
        }

        participant.chargedMinutes = minuteIndex;
        participant.creditCharged = Math.max(
          participant.creditCharged || 0,
          minuteIndex,
        );
        if (deductResult?.charged) creditDeducted += 1;
      } catch (err) {
        this.logger.warn(
          `Failed to settle group credit for user ${participant.userId} in room ${room.id}:`,
          err,
        );
        break;
      }
    }

    if (insufficientBalance) {
      participant.connectionStatus = ConnectionStatus.DISCONNECTED;
      participant.leftAt = now;
      participant.lastHeartbeatAt = null;
      await this.livekitService.removeParticipant(
        room.livekitRoomName,
        participant.userId,
      );
    }
    await this.participantRepo.save(participant);

    return { creditDeducted, newBalance, insufficientBalance };
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

  // ════════════════════════════════════════════════════════════════
  // 8. CRON JOB: AUTOMATED SESSION LIFECYCLE (OPEN & CLOSE)
  // ════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutomatedSessionLifecycle() {
    // 1. Auto-close sessions that reached scheduledEnd
    try {
      const activeRooms = await this.roomRepo.find({
        where: {
          status: RoomStatus.IN_PROGRESS,
          roomType: RoomType.ONE_ON_ONE,
        },
      });

      const now = new Date();

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
  }
}
