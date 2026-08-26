import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { SendBookingMessageDto } from '@app/contracts/booking';
import { BookingClient } from '../clients/booking.client';
import { NotificationGateway } from './notification.gateway';

type BookingSocketAck<T = unknown> =
  { success: true; data?: T } | { success: false; error: string };

interface BookingSocketData {
  userId: string;
  token: string;
}

type BookingSocket = Socket<
  Record<string, (...args: unknown[]) => void>,
  Record<string, (...args: unknown[]) => void>,
  Record<string, (...args: unknown[]) => void>,
  BookingSocketData
>;

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/bookings',
  transports: ['websocket'],
})
export class BookingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BookingGateway.name);

  constructor(
    private readonly bookingClient: BookingClient,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  handleConnection(client: BookingSocket) {
    const token = this.getToken(client);
    if (!token) {
      this.logger.warn(`Rejected unauthenticated booking socket ${client.id}`);
      client.disconnect(true);
      return;
    }

    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded === 'string') {
      client.disconnect(true);
      return;
    }
    const payload = decoded as Record<string, unknown>;
    const userId = payload.sub || payload.id || payload.userId;
    if (typeof userId !== 'string') {
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    client.data.token = token;
    this.logger.debug(`Booking socket ${client.id} connected as ${userId}`);
  }

  handleDisconnect(client: BookingSocket) {
    this.logger.debug(`Booking socket ${client.id} disconnected`);
  }

  @SubscribeMessage('booking-chat:join')
  async joinBookingChat(
    @ConnectedSocket() client: BookingSocket,
    @MessageBody() data: { bookingId?: string },
  ): Promise<BookingSocketAck> {
    if (!data?.bookingId) return { success: false, error: 'Thiếu bookingId' };

    try {
      await this.ensureAuthorized(client, data.bookingId);
      await client.join(this.roomName(data.bookingId));
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage('booking-chat:leave')
  async leaveBookingChat(
    @ConnectedSocket() client: BookingSocket,
    @MessageBody() data: { bookingId?: string },
  ): Promise<BookingSocketAck> {
    if (!data?.bookingId) return { success: false, error: 'Thiếu bookingId' };
    await client.leave(this.roomName(data.bookingId));
    return { success: true };
  }

  @SubscribeMessage('booking-message:send')
  async sendMessage(
    @ConnectedSocket() client: BookingSocket,
    @MessageBody() data: SendBookingMessageDto & { bookingId?: string },
  ): Promise<BookingSocketAck> {
    const bookingId = data?.bookingId;
    if (!bookingId) return { success: false, error: 'Thiếu bookingId' };

    try {
      await this.ensureAuthorized(client, bookingId);
      await client.join(this.roomName(bookingId));
      const body: SendBookingMessageDto = {
        content: data.content,
        type: data.type,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        attachmentSize: data.attachmentSize,
        attachmentMime: data.attachmentMime,
        attachmentPublicId: data.attachmentPublicId,
        attachmentResourceType: data.attachmentResourceType,
      };
      const message = (await this.bookingClient.sendBookingMessage(
        bookingId,
        body,
        this.authHeaders(client),
      )) as unknown;

      this.broadcastMessage(bookingId, message);
      this.notificationGateway.broadcastNotificationUpdate({
        type: 'NOTIFICATION_UPDATE',
        bookingId,
        senderId: client.data.userId,
      });
      return { success: true, data: message };
    } catch (error: unknown) {
      return { success: false, error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage('booking-typing:set')
  async setTyping(
    @ConnectedSocket() client: BookingSocket,
    @MessageBody()
    data: { bookingId?: string; typing?: boolean; clientId?: string },
  ): Promise<BookingSocketAck> {
    const bookingId = data?.bookingId;
    if (!bookingId) return { success: false, error: 'Thiếu bookingId' };

    try {
      await this.ensureAuthorized(client, bookingId);
      await client.join(this.roomName(bookingId));
      const typing = Boolean(data.typing);
      await this.bookingClient.setTypingStatus(
        bookingId,
        typing,
        this.authHeaders(client),
      );
      this.broadcastTyping(bookingId, {
        bookingId,
        userId: client.data.userId,
        clientId: data.clientId,
        typing,
      });
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: this.errorMessage(error) };
    }
  }

  broadcastMessage(bookingId: string, message: unknown) {
    this.server
      .to(this.roomName(bookingId))
      .emit('booking-message:new', message);
  }

  broadcastTyping(bookingId: string, payload: unknown) {
    this.server
      .to(this.roomName(bookingId))
      .emit('booking-typing:changed', payload);
  }

  private async ensureAuthorized(client: BookingSocket, bookingId: string) {
    if (!client.data.token) throw new Error('Socket chưa được xác thực');
    if (client.rooms.has(this.roomName(bookingId))) return;
    // Booking Service owns membership/status authorization. This call also prevents
    // clients from subscribing to arbitrary booking rooms.
    await this.bookingClient.getBookingMessages(
      bookingId,
      this.authHeaders(client),
    );
  }

  private getToken(client: BookingSocket): string | undefined {
    const handshakeAuth = client.handshake.auth as Record<string, unknown>;
    const authToken =
      typeof handshakeAuth.token === 'string' ? handshakeAuth.token : undefined;
    const headerToken = client.handshake.headers?.authorization?.replace(
      /^Bearer\s+/i,
      '',
    );
    const queryToken = client.handshake.query?.token;
    return (
      authToken ||
      headerToken ||
      (typeof queryToken === 'string' ? queryToken : undefined)
    );
  }

  private authHeaders(client: BookingSocket): Record<string, string> {
    return { Authorization: `Bearer ${client.data.token}` };
  }

  private roomName(bookingId: string) {
    return `booking_${bookingId}`;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      if (typeof record.message === 'string') return record.message;
      if (record.response && typeof record.response === 'object') {
        const response = record.response as Record<string, unknown>;
        if (typeof response.message === 'string') return response.message;
      }
    }
    return 'Không thể xử lý chat booking';
  }
}
