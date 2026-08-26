import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { SessionClient } from '../clients/session.client';
import {
  CreateGroupRoomDto,
  GetActiveGroupRoomsQueryDto,
  CloseOneOnOneRoomDto,
  MuteParticipantDto,
  KickParticipantDto,
  SendRoomChatMessageDto,
} from '@app/contracts/session';

@ApiTags('Session - Phòng học trực tuyến & Thời gian thực')
@Controller('rooms')
export class SessionRoutes {
  constructor(private readonly sessionClient: SessionClient) {}

  // ════════════════════════════════════════════════════════════════
  // 1. PHÒNG HỌC 1:1 (ONE-ON-ONE)
  // ════════════════════════════════════════════════════════════════

  @Post('one-on-one/:bookingId/open')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor mở phòng học 1:1 và nhận LiveKit Token' })
  async openOneOnOneRoom(@Param('bookingId') bookingId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.sessionClient.send('session.openOneOnOne', { userId, bookingId });
  }

  @Post('one-on-one/:bookingId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Learner/Mentor tham gia phòng học 1:1 và nhận LiveKit Token' })
  async joinOneOnOneRoom(@Param('bookingId') bookingId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.sessionClient.send('session.joinOneOnOne', { userId, bookingId });
  }

  @Post('one-on-one/:bookingId/close')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor kết thúc phòng học 1:1 và giải phóng tiền ký quỹ Escrow' })
  async closeOneOnOneRoom(
    @Param('bookingId') bookingId: string,
    @Body() dto: CloseOneOnOneRoomDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.sessionClient.send('session.closeOneOnOne', {
      userId,
      bookingId,
      closeReason: dto.closeReason,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 2. PHÒNG HỌC NHÓM (GROUP STUDY ROOMS)
  // ════════════════════════════════════════════════════════════════

  @Post('group')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor tạo phòng học nhóm' })
  @ApiBody({ type: CreateGroupRoomDto })
  async createGroupRoom(@Body() dto: CreateGroupRoomDto, @Req() req: any) {
    const userId = req.user.id;
    return this.sessionClient.send('session.createGroup', { userId, dto });
  }

  @Post('group/:roomId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Learner tham gia phòng học nhóm' })
  async joinGroupRoom(@Param('roomId') roomId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.sessionClient.send('session.joinGroup', { userId, roomId });
  }

  @Post('group/:roomId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Learner rời phòng học nhóm' })
  async leaveGroupRoom(@Param('roomId') roomId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.sessionClient.send('session.leaveGroup', { userId, roomId });
  }

  @Post('group/:roomId/close')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor (Host) đóng phòng học nhóm' })
  async closeGroupRoom(@Param('roomId') roomId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.sessionClient.send('session.closeGroup', { userId, roomId });
  }

  @Get('group/active')
  @ApiOperation({ summary: 'Lấy danh sách các phòng học nhóm đang hoạt động' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  async getActiveGroupRooms(@Query() query: GetActiveGroupRoomsQueryDto) {
    return this.sessionClient.send('session.getActiveGroupRooms', { query });
  }

  @Get('group/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lịch sử phòng học nhóm đã kết thúc' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  async getGroupRoomsHistory(@Query() query: any, @Req() req: any) {
    const userId = req.user.id;
    return this.sessionClient.send('session.getGroupRoomsHistory', { userId, query });
  }

  // ════════════════════════════════════════════════════════════════
  // 3. QUẢN LÝ PHÒNG & MODERATION (HOST ACTIONS)
  // ════════════════════════════════════════════════════════════════

  @Post(':roomId/mute/:participantId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor tắt mic người tham gia' })
  async muteParticipant(
    @Param('roomId') roomId: string,
    @Param('participantId') participantId: string,
    @Body() dto: MuteParticipantDto,
    @Req() req: any,
  ) {
    const hostId = req.user.id;
    return this.sessionClient.send('session.muteParticipant', {
      hostId,
      roomId,
      participantId,
      isMuted: dto.isMuted !== undefined ? dto.isMuted : true,
    });
  }

  @Post(':roomId/kick/:participantId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor mời người tham gia ra khỏi phòng' })
  async kickParticipant(
    @Param('roomId') roomId: string,
    @Param('participantId') participantId: string,
    @Body() dto: KickParticipantDto,
    @Req() req: any,
  ) {
    const hostId = req.user.id;
    return this.sessionClient.send('session.kickParticipant', {
      hostId,
      roomId,
      participantId,
      reason: dto.reason,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 4. IN-ROOM CHAT
  // ════════════════════════════════════════════════════════════════

  @Get(':roomId/chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử tin nhắn trong phòng học' })
  async getChatMessages(@Param('roomId') roomId: string, @Req() req: any) {
    return this.sessionClient.send('session.getChatMessages', { roomId, userId: req.user.id });
  }

  @Post(':roomId/chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi tin nhắn trong phòng học' })
  async sendChatMessage(
    @Param('roomId') roomId: string,
    @Body() dto: SendRoomChatMessageDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.sessionClient.send('session.sendChatMessage', {
      userId,
      roomId,
      content: dto.content,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 5. SCREEN RECORDING
  // ════════════════════════════════════════════════════════════════

  @Post(':roomId/recording/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bắt đầu ghi hình buổi học' })
  async startRecording(@Param('roomId') roomId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.sessionClient.send('session.startRecording', { userId, roomId });
  }
}
