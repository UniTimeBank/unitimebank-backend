import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SessionClient } from '../clients/session.client';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/sessions',
})
export class SessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SessionGateway.name);

  constructor(private readonly sessionClient: SessionClient) {}

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.debug(`Session socket client ${client.id} connected without auth token`);
        return;
      }

      const secret = process.env.JWT_ACCESS_SECRET || 'secret';
      const decoded = jwt.verify(token, secret) as any;
      client.data.userId = decoded.sub || decoded.id || decoded.userId;

      this.logger.log(
        `Session socket client ${client.id} authenticated as user ${client.data.userId}`,
      );
    } catch (err: any) {
      this.logger.debug(`Session socket auth failed for client ${client.id}: ${err.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Session socket client ${client.id} disconnected`);
  }

  /**
   * Tham gia phòng Socket riêng của room để nhận broadcast
   */
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ) {
    const userId = data.userId || client.data.userId;
    const roomId = data.roomId;
    if (!roomId) return { success: false, message: 'Thiếu roomId' };

    client.join(`room_${roomId}`);
    this.logger.log(`User ${userId} joined socket room room_${roomId}`);

    client.to(`room_${roomId}`).emit('user-joined-room', {
      userId,
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });

    return { success: true, roomId };
  }

  /**
   * Rời khỏi phòng Socket
   */
  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ) {
    const userId = data.userId || client.data.userId;
    const roomId = data.roomId;
    if (!roomId) return { success: false };

    client.leave(`room_${roomId}`);
    this.logger.log(`User ${userId} left socket room room_${roomId}`);

    client.to(`room_${roomId}`).emit('user-left-room', {
      userId,
      socketId: client.id,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Heartbeat gửi mỗi 60 giây để duy trì trạng thái & trừ Credit
   */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ) {
    const userId = data.userId || client.data.userId;
    const roomId = data.roomId;
    if (!roomId || !userId) return { success: false };

    try {
      const ack = await this.sessionClient.send('session.heartbeat', { userId, roomId });
      client.emit('heartbeat-ack', ack);
      return ack;
    } catch (err: any) {
      this.logger.warn(`Heartbeat error for user ${userId} in room ${roomId}:`, err);
      return { success: false, error: err?.message };
    }
  }

  /**
   * Nhắn tin văn bản & tài liệu thời gian thực trong phòng học
   */
  @SubscribeMessage('send-room-message')
  async handleSendRoomMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      userId?: string;
      content: string;
      senderName?: string;
      senderAvatar?: string;
      attachmentUrl?: string;
      attachmentName?: string;
    },
  ) {
    const userId = data.userId || client.data.userId;
    const roomId = data.roomId;
    if (!roomId || (!data.content && !data.attachmentUrl)) return;

    try {
      const saved = await this.sessionClient.send<any>('session.sendChatMessage', {
        userId,
        roomId,
        content: data.content || '',
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
      });

      const payload = {
        ...(saved || {}),
        content: data.content || saved?.content || '',
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        attachmentUrl: data.attachmentUrl || saved?.attachmentUrl,
        attachmentName: data.attachmentName || saved?.attachmentName,
        sentAt: saved?.sentAt || new Date().toISOString(),
      };

      this.server.to(`room_${roomId}`).emit('new-room-message', payload);
      return payload;
    } catch (err: any) {
      this.logger.error(`Error sending in-room message:`, err);
      const fallbackPayload = {
        id: `msg_${Date.now()}`,
        roomId,
        senderId: userId,
        content: data.content,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        sentAt: new Date().toISOString(),
      };
      this.server.to(`room_${roomId}`).emit('new-room-message', fallbackPayload);
      return fallbackPayload;
    }
  }

  /**
   * Host tắt mic người tham gia
   */
  @SubscribeMessage('mute-participant')
  async handleMuteParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; participantId: string; isMuted?: boolean },
  ) {
    const hostId = client.data.userId;
    if (!data.roomId || !data.participantId) return;

    try {
      const res = await this.sessionClient.send('session.muteParticipant', {
        hostId,
        roomId: data.roomId,
        participantId: data.participantId,
        isMuted: data.isMuted !== undefined ? data.isMuted : true,
      });

      this.server.to(`room_${data.roomId}`).emit('participant-muted', res);
      return res;
    } catch (err: any) {
      return { error: err?.message };
    }
  }

  /**
   * Host mời người tham gia ra khỏi phòng
   */
  @SubscribeMessage('kick-participant')
  async handleKickParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; participantId: string; reason?: string },
  ) {
    const hostId = client.data.userId;
    if (!data.roomId || !data.participantId) return;

    try {
      const res = await this.sessionClient.send('session.kickParticipant', {
        hostId,
        roomId: data.roomId,
        participantId: data.participantId,
        reason: data.reason,
      });

      this.server.to(`room_${data.roomId}`).emit('participant-kicked', res);
      return res;
    } catch (err: any) {
      return { error: err?.message };
    }
  }

  /**
   * Đồng bộ bảng vẽ thời gian thực (Whiteboard)
   */
  @SubscribeMessage('whiteboard-draw')
  handleWhiteboardDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; drawData: any },
  ) {
    if (!data.roomId) return;
    client.to(`room_${data.roomId}`).emit('whiteboard-update', data.drawData);
  }

  /**
   * Đồng bộ trình soạn thảo mã nguồn trực tiếp (Code Editor)
   */
  @SubscribeMessage('code-editor-change')
  handleCodeEditorChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; code: string; language?: string },
  ) {
    if (!data.roomId) return;
    client.to(`room_${data.roomId}`).emit('code-editor-update', {
      code: data.code,
      language: data.language,
      senderId: client.data.userId,
    });
  }

  /**
   * Đồng bộ ghi chú thời gian thực (Session Notes)
   */
  @SubscribeMessage('note-update')
  handleNoteUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string },
  ) {
    if (!data.roomId) return;
    client.to(`room_${data.roomId}`).emit('note-update', data.content);
  }
}
