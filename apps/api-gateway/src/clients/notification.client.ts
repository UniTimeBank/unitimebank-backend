import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type {
  GetMyNotificationsResponseDto,
  UnreadCountResponseDto,
  NotificationItemDto,
} from '@app/contracts/notification';

@Injectable()
export class NotificationClient {
  private client: ClientProxy;

  constructor() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: 'notification_queue',
        queueOptions: { durable: false },
      },
    });
  }

  send<T>(pattern: string, data: any): Promise<T> {
    return firstValueFrom(this.client.send<T>(pattern, data).pipe(timeout(10000)));
  }

  emit<T>(pattern: string, data: any) {
    return this.client.emit(pattern, data);
  }

  async getMyNotifications(
    userId: string,
    query: { limit?: number; unreadOnly?: boolean },
  ): Promise<GetMyNotificationsResponseDto> {
    return this.send<GetMyNotificationsResponseDto>('notification.getMyNotifications', {
      userId,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
    });
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    return this.send<UnreadCountResponseDto>('notification.getUnreadCount', { userId });
  }

  async markAsRead(userId: string, id: string): Promise<NotificationItemDto> {
    return this.send<NotificationItemDto>('notification.markAsRead', { userId, id });
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; message: string }> {
    return this.send<{ success: boolean; message: string }>('notification.markAllAsRead', {
      userId,
    });
  }

  async deleteNotification(userId: string, id: string): Promise<{ success: boolean }> {
    return this.send<{ success: boolean }>('notification.delete', { userId, id });
  }
}
