import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/community',
})
export class CommunityGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CommunityGateway.name);

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.debug(`Community socket client ${client.id} connected without token`);
        return;
      }

      const decoded: any = jwt.decode(token);
      const userId = decoded?.sub || decoded?.id;

      if (userId) {
        client.data.userId = userId;
        client.join(`user_${userId}`);
        this.logger.log(`Community socket client ${client.id} joined user room: user_${userId}`);
      }
    } catch (err: any) {
      this.logger.error(`Error in community socket auth: ${err?.message || err}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Community socket client ${client.id} disconnected`);
  }

  @SubscribeMessage('group:join')
  handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    if (data?.groupId) {
      const roomName = `group_${data.groupId}`;
      client.join(roomName);
      this.logger.log(`Client ${client.id} joined community room: ${roomName}`);
      return { success: true, room: roomName };
    }
    return { success: false, error: 'groupId is required' };
  }

  @SubscribeMessage('group:leave')
  handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    if (data?.groupId) {
      const roomName = `group_${data.groupId}`;
      client.leave(roomName);
      this.logger.log(`Client ${client.id} left community room: ${roomName}`);
      return { success: true, room: roomName };
    }
    return { success: false, error: 'groupId is required' };
  }

  /**
   * Phát sóng sự kiện thời gian thực đến toàn bộ thành viên đang xem nhóm
   */
  emitToGroup(groupId: string, event: string, payload: any) {
    if (this.server && groupId) {
      const roomName = `group_${groupId}`;
      this.server.to(roomName).emit(event, payload);
      this.logger.log(`Emitted [${event}] to room [${roomName}]`);
    }
  }

  /**
   * Bắn sự kiện thời gian thực tới 1 người dùng cụ thể
   */
  sendToUser(userId: string, event: string, payload: any) {
    if (this.server && userId) {
      const roomName = `user_${userId}`;
      this.server.to(roomName).emit(event, payload);
      this.logger.log(`Sent [${event}] to user room [${roomName}]`);
    }
  }

  /**
   * Phát sóng toàn hệ thống
   */
  broadcast(event: string, payload: any) {
    if (this.server) {
      this.server.emit(event, payload);
    }
  }
}
