import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationInbox,
  NotificationDelivery,
  NotificationPreference,
} from './entities';
import { NotificationKind } from './enums';
import type { CreateNotificationEvent } from '@app/contracts/events';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationInbox)
    private readonly inboxRepo: Repository<NotificationInbox>,
  ) {}

  /**
   * Tạo bản ghi thông báo và đưa vào Hộp thư (Inbox) của người dùng
   */
  async createNotification(data: CreateNotificationEvent): Promise<Notification> {
    const { userId, title, content, type, referenceId } = data;

    // Map type string sang NotificationKind phù hợp
    let kind = NotificationKind.BOOKING_CREATED;
    if (type?.includes('ACCEPTED')) {
      kind = NotificationKind.BOOKING_ACCEPTED;
    } else if (type?.includes('REJECTED')) {
      kind = NotificationKind.BOOKING_REJECTED;
    } else if (type?.includes('CANCELLED')) {
      kind = NotificationKind.BOOKING_CANCELLED;
    } else if (type?.includes('POST')) {
      kind = NotificationKind.POST_NEW_FROM_FOLLOWED_MENTOR;
    } else if (type?.includes('REWARD') || type?.includes('STREAK')) {
      kind = NotificationKind.WALLET_REWARD_GRANTED;
    }

    const notification = this.notificationRepo.create({
      recipientId: userId,
      kind,
      title: title || 'Thông báo từ hệ thống',
      body: content || '',
      sourceEvent: type || 'SYSTEM',
      payloadRef: referenceId,
    });

    const savedNotification = await this.notificationRepo.save(notification);

    // Tạo bản ghi Inbox cho người nhận
    const inbox = this.inboxRepo.create({
      recipientId: userId,
      notificationId: savedNotification.id,
      isRead: false,
    });
    await this.inboxRepo.save(inbox);

    this.logger.log(`Created notification [${savedNotification.id}] for user [${userId}]`);
    return savedNotification;
  }

  /**
   * Lấy danh sách thông báo trong Hộp thư của người dùng
   */
  async getMyNotifications(recipientId: string, limit = 20): Promise<NotificationInbox[]> {
    return this.inboxRepo.find({
      where: { recipientId },
      relations: { notification: true },
      order: { notification: { createdAt: 'DESC' } },
      take: limit,
    });
  }


  /**
   * Đánh dấu 1 thông báo đã đọc
   */
  async markAsRead(recipientId: string, inboxId: string): Promise<NotificationInbox> {
    const inbox = await this.inboxRepo.findOne({
      where: { id: inboxId, recipientId },
    });
    if (!inbox) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    inbox.isRead = true;
    inbox.readAt = new Date();
    return this.inboxRepo.save(inbox);
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   */
  async markAllAsRead(recipientId: string): Promise<void> {
    await this.inboxRepo.update(
      { recipientId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }
}
