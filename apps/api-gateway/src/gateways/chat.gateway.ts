import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { BookingClient } from '../clients/booking.client';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly jwtSecret =
    process.env.JWT_SECRET || 'unitimebank-shared-jwt-secret-key-2026';

  constructor(private readonly bookingClient: BookingClient) {}

  handleConnection(client: Socket) {
    try {
      let token = client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (token && typeof token === 'string' && token.startsWith('Bearer ')) {
        token = token.slice(7);
      }

      if (token && typeof token === 'string') {
        const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
        client.data.user = {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
        };
        // Join personal user room for targeted notifications
        client.join(`user_${decoded.sub}`);
        this.logger.log(`Client connected: ${client.id} (User: ${decoded.sub})`);
      } else {
        this.logger.warn(`Client connected without valid token: ${client.id}`);
      }
    } catch (err: any) {
      this.logger.error(`Handshake auth failed for ${client.id}: ${err.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:join')
  handleJoinBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string },
  ) {
    if (data?.bookingId) {
      const room = `booking_${data.bookingId}`;
      client.join(room);
      this.logger.log(`Socket ${client.id} joined room ${room}`);
      return { status: 'joined', room };
    }
  }

  @SubscribeMessage('chat:leave')
  handleLeaveBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string },
  ) {
    if (data?.bookingId) {
      const room = `booking_${data.bookingId}`;
      client.leave(room);
      this.logger.log(`Socket ${client.id} left room ${room}`);
      return { status: 'left', room };
    }
  }

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string; typing: boolean },
  ) {
    if (data?.bookingId) {
      const room = `booking_${data.bookingId}`;
      const userId = client.data?.user?.id;
      // Broadcast tức thì 0ms tới đối tác trong cùng room
      client.to(room).emit('chat:user_typing', {
        bookingId: data.bookingId,
        userId: userId || client.id,
        socketId: client.id,
        typing: Boolean(data.typing),
      });
    }
  }


  @SubscribeMessage('chat:send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string; content: string; attachmentUrl?: string },
  ) {
    if (!data?.bookingId || !data?.content) return;

    const token = client.handshake.auth?.token || client.handshake.headers?.authorization;
    const authHeaders: Record<string, string> = token
      ? { authorization: typeof token === 'string' && token.startsWith('Bearer ') ? token : `Bearer ${token}` }
      : {};


    try {
      // 1. Lưu tin nhắn vào Database thông qua BookingClient
      const savedMessage = await this.bookingClient.sendBookingMessage(
        data.bookingId,
        { content: data.content, attachmentUrl: data.attachmentUrl },
        authHeaders,
      );

      // 2. Broadcast tin nhắn mới ngay lập tức cho cả phòng
      const room = `booking_${data.bookingId}`;
      this.server.to(room).emit('chat:new_message', {
        bookingId: data.bookingId,
        message: savedMessage,
      });

      return { status: 'success', message: savedMessage };
    } catch (err: any) {
      this.logger.error(`Error sending message via socket: ${err.message}`);
      client.emit('chat:error', { message: 'Không thể gửi tin nhắn qua socket' });
    }
  }

  @SubscribeMessage('chat:mark_seen')
  async handleMarkSeen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string },
  ) {
    if (!data?.bookingId) return;

    const room = `booking_${data.bookingId}`;
    const userId = client.data?.user?.id;

    // Broadcast tới người gửi là tin nhắn đã được xem
    client.to(room).emit('chat:message_seen', {
      bookingId: data.bookingId,
      seenBy: userId,
      readAt: new Date().toISOString(),
    });
  }
}
