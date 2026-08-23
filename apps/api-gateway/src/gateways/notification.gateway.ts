import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
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
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.debug(`Socket client ${client.id} connected without auth token`);
        return;
      }

      const decoded: any = jwt.decode(token);
      const userId = decoded?.sub || decoded?.id;

      if (userId) {
        client.data.userId = userId;
        client.join(`user_${userId}`);
        this.logger.log(`Socket client ${client.id} joined notification room: user_${userId}`);
      }
    } catch (err) {
      this.logger.error(`Error in socket auth connection: ${err?.message || err}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket client ${client.id} disconnected`);
  }

  /**
   * Bắn thông báo thời gian thực tới 1 người dùng cụ thể
   */
  sendNotificationToUser(userId: string, data: any) {
    if (this.server) {
      this.server.to(`user_${userId}`).emit('notification:new', data);
      this.server.to(`user_${userId}`).emit('notification:update', { timestamp: Date.now(), data });
    }
  }

  /**
   * Phát sóng cập nhật thông báo tới toàn bộ client
   */
  broadcastNotificationUpdate(data?: any) {
    if (this.server) {
      this.server.emit('notification:update', data || { timestamp: Date.now() });
    }
  }
}
