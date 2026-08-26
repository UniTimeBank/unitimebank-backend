import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { SessionService } from './session.service';
import {
  CreateGroupRoomDto,
  GetActiveGroupRoomsQueryDto,
  RoomCloseReason,
} from '@app/contracts/session';

@Controller()
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(private readonly sessionService: SessionService) {}

  // ════════════════════════════════════════════════════════════════
  // 1. PHÒNG HỌC 1:1 (ONE-ON-ONE)
  // ════════════════════════════════════════════════════════════════

  @MessagePattern('session.openOneOnOne')
  async openOneOnOne(@Payload() data: { userId: string; bookingId: string }) {
    try {
      return await this.sessionService.openOneOnOneRoom(data.userId, data.bookingId);
    } catch (err: any) {
      this.logger.error(`[session.openOneOnOne] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể mở phòng học 1:1',
      });
    }
  }

  @MessagePattern('session.joinOneOnOne')
  async joinOneOnOne(@Payload() data: { userId: string; bookingId: string }) {
    try {
      return await this.sessionService.joinOneOnOneRoom(data.userId, data.bookingId);
    } catch (err: any) {
      this.logger.error(`[session.joinOneOnOne] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể tham gia phòng học 1:1',
      });
    }
  }

  @MessagePattern('session.closeOneOnOne')
  async closeOneOnOne(
    @Payload() data: { userId: string; bookingId: string; closeReason?: RoomCloseReason },
  ) {
    try {
      return await this.sessionService.closeOneOnOneRoom(data.userId, data.bookingId, data.closeReason);
    } catch (err: any) {
      this.logger.error(`[session.closeOneOnOne] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể kết thúc phòng học 1:1',
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 2. PHÒNG HỌC NHÓM (GROUP STUDY)
  // ════════════════════════════════════════════════════════════════

  @MessagePattern('session.createGroup')
  async createGroup(@Payload() data: { userId: string; dto: CreateGroupRoomDto }) {
    try {
      return await this.sessionService.createGroupRoom(data.userId, data.dto);
    } catch (err: any) {
      this.logger.error(`[session.createGroup] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể tạo phòng học nhóm',
      });
    }
  }

  @MessagePattern('session.joinGroup')
  async joinGroup(@Payload() data: { userId: string; roomId: string }) {
    try {
      return await this.sessionService.joinGroupRoom(data.userId, data.roomId);
    } catch (err: any) {
      this.logger.error(`[session.joinGroup] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể tham gia phòng học nhóm',
      });
    }
  }

  @MessagePattern('session.leaveGroup')
  async leaveGroup(@Payload() data: { userId: string; roomId: string }) {
    try {
      return await this.sessionService.leaveGroupRoom(data.userId, data.roomId);
    } catch (err: any) {
      this.logger.error(`[session.leaveGroup] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể rời phòng học nhóm',
      });
    }
  }

  @MessagePattern('session.closeGroup')
  async closeGroup(@Payload() data: { userId: string; roomId: string }) {
    try {
      return await this.sessionService.closeGroupRoom(data.userId, data.roomId);
    } catch (err: any) {
      this.logger.error(`[session.closeGroup] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể đóng phòng học nhóm',
      });
    }
  }

  @MessagePattern('session.getActiveGroupRooms')
  async getActiveGroupRooms(@Payload() data: { query: GetActiveGroupRoomsQueryDto }) {
    try {
      return await this.sessionService.getActiveGroupRooms(data.query || {});
    } catch (err: any) {
      this.logger.error(`[session.getActiveGroupRooms] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể lấy danh sách phòng nhóm',
      });
    }
  }

  @MessagePattern('session.getGroupRoomsHistory')
  async getGroupRoomsHistory(@Payload() data: { userId: string; query?: any }) {
    try {
      return await this.sessionService.getGroupRoomsHistory(data.userId, data.query);
    } catch (err: any) {
      this.logger.error(`[session.getGroupRoomsHistory] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Không thể lấy lịch sử phòng nhóm',
      });
    }
  }

  // ════════════════════════════════════════════════════════════════
  // 3. QUẢN LÝ PHÒNG & MODERATION
  // ════════════════════════════════════════════════════════════════

  @MessagePattern('session.muteParticipant')
  async muteParticipant(
    @Payload() data: { hostId: string; roomId: string; participantId: string; isMuted?: boolean },
  ) {
    try {
      return await this.sessionService.muteParticipant(
        data.hostId,
        data.roomId,
        data.participantId,
        data.isMuted ?? true,
      );
    } catch (err: any) {
      this.logger.error(`[session.muteParticipant] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Lỗi tắt tiếng thành viên',
      });
    }
  }

  @MessagePattern('session.kickParticipant')
  async kickParticipant(
    @Payload() data: { hostId: string; roomId: string; participantId: string; reason?: string },
  ) {
    try {
      return await this.sessionService.kickParticipant(
        data.hostId,
        data.roomId,
        data.participantId,
        data.reason,
      );
    } catch (err: any) {
      this.logger.error(`[session.kickParticipant] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Lỗi mời thành viên ra khỏi phòng',
      });
    }
  }

  @MessagePattern('session.getChatMessages')
  async getChatMessages(@Payload() data: { userId: string; roomId: string }) {
    try {
      return await this.sessionService.getRoomChatMessages(data.userId, data.roomId);
    } catch (err: any) {
      this.logger.error(`[session.getChatMessages] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Lỗi tải tin nhắn phòng học',
      });
    }
  }

  @MessagePattern('session.sendChatMessage')
  async sendChatMessage(
    @Payload()
    data: {
      userId: string;
      roomId: string;
      message?: string;
      content?: string;
        attachmentUrl?: string;
        attachmentName?: string;
        attachmentPublicId?: string;
        attachmentResourceType?: 'image' | 'raw' | 'video';
    },
  ) {
    try {
      return await this.sessionService.sendRoomChatMessage(
        data.userId,
        data.roomId,
        data.content || data.message || '',
        data.attachmentUrl,
        data.attachmentName,
        data.attachmentPublicId,
        data.attachmentResourceType,
      );
    } catch (err: any) {
      this.logger.error(`[session.sendChatMessage] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Lỗi gửi tin nhắn phòng học',
      });
    }
  }

  @MessagePattern('session.heartbeat')
  async heartbeat(@Payload() data: { userId: string; roomId: string }) {
    try {
      return await this.sessionService.processHeartbeat(data.userId, data.roomId);
    } catch (err: any) {
      this.logger.error(`[session.heartbeat] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Lỗi ghi nhận heartbeat',
      });
    }
  }

  @MessagePattern('session.startRecording')
  async startRecording(@Payload() data: { userId: string; roomId: string }) {
    try {
      return await this.sessionService.startRecording(data.userId, data.roomId);
    } catch (err: any) {
      this.logger.error(`[session.startRecording] Error:`, err?.stack || err);
      throw new RpcException({
        status: err?.status || err?.statusCode || 400,
        message: err?.message || 'Lỗi ghi hình buổi học',
      });
    }
  }
}
