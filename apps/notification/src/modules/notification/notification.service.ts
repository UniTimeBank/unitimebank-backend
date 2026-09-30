import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationInbox,
  DeviceToken,
} from './entities';
import { NotificationKind } from './enums';
import type { CreateNotificationEvent } from '@app/contracts/events';
import type { GetMyNotificationsResponseDto, UnreadCountResponseDto } from '@app/contracts/notification';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationInbox)
    private readonly inboxRepo: Repository<NotificationInbox>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,
  ) {}

  /**
   * Tạo bản ghi thông báo và đưa vào Hộp thư (Inbox) của người dùng
   */
  async createNotification(data: CreateNotificationEvent): Promise<Notification> {
    const { userId, title, content, type, referenceId } = data;

    // Map type string sang NotificationKind phù hợp
    let kind = NotificationKind.BOOKING_CREATED;
    const typeUpper = (type || '').toUpperCase();

    if (typeUpper.includes('ACCEPTED')) {
      kind = NotificationKind.BOOKING_ACCEPTED;
    } else if (typeUpper.includes('REJECTED')) {
      kind = NotificationKind.BOOKING_REJECTED;
    } else if (typeUpper.includes('CANCELLED')) {
      kind = NotificationKind.BOOKING_CANCELLED;
    } else if (typeUpper.includes('STARTED')) {
      kind = NotificationKind.BOOKING_STARTED;
    } else if (typeUpper.includes('COMPLETED')) {
      kind = NotificationKind.BOOKING_COMPLETED;
    } else if (typeUpper.includes('CHAT') || typeUpper.includes('MESSAGE')) {
      kind = NotificationKind.CHAT_MESSAGE;
    } else if (typeUpper.includes('POST')) {
      kind = NotificationKind.POST_NEW_FROM_FOLLOWED_MENTOR;
    } else if (typeUpper.includes('REWARD') || typeUpper.includes('STREAK')) {
      kind = NotificationKind.WALLET_REWARD_GRANTED;
    } else if (typeUpper.includes('REGISTERED')) {
      kind = NotificationKind.USER_REGISTERED;
    } else if (typeUpper.includes('MODERATION')) {
      kind = NotificationKind.MODERATION_RESULT;
    }

    // Chống trùng lặp thông báo (Deduplication) cho các sự kiện duy nhất theo referenceId
    if (referenceId && kind !== NotificationKind.CHAT_MESSAGE) {
      const existing = await this.notificationRepo.findOne({
        where: {
          recipientId: userId,
          kind,
          payloadRef: referenceId,
        },
      });
      if (existing) {
        this.logger.log(
          `[createNotification] Deduplicated duplicate notification for user [${userId}], kind [${kind}], ref [${referenceId}]`,
        );
        return existing;
      }
    }

    const notification = this.notificationRepo.create({
      recipientId: userId,
      kind,
      title: title || 'Thông báo từ hệ thống',
      body: content || '',
      sourceEvent: type || 'SYSTEM',
      payloadRef: referenceId,
      avatarUrl: data.avatarUrl || undefined,
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

    // Gửi thông báo đẩy Remote Push Notification (FCM / Expo) tới thiết bị của người dùng
    this.sendRemotePush(
      userId,
      savedNotification.title,
      savedNotification.body,
      {
        notificationId: savedNotification.id,
        kind: savedNotification.kind,
        referenceId: savedNotification.payloadRef,
        sourceEvent: savedNotification.sourceEvent,
      },
    ).catch((err) => {
      this.logger.warn(`Failed to dispatch remote push: ${err?.message || err}`);
    });

    return savedNotification;
  }

  /**
   * Lưu hoặc cập nhật Device Push Token của người dùng
   */
  async savePushToken(
    userId: string,
    token: string,
    platform = 'android',
  ): Promise<{ success: boolean; message: string }> {
    if (!token || !userId) {
      return { success: false, message: 'Invalid token or userId' };
    }

    try {
      let deviceToken = await this.deviceTokenRepo.findOne({
        where: { userId, token },
      });

      if (deviceToken) {
        deviceToken.isActive = true;
        deviceToken.platform = platform;
        await this.deviceTokenRepo.save(deviceToken);
      } else {
        deviceToken = this.deviceTokenRepo.create({
          userId,
          token,
          platform,
          isActive: true,
        });
        await this.deviceTokenRepo.save(deviceToken);
      }

      this.logger.log(`Saved push token for user [${userId}], platform [${platform}]`);
      return { success: true, message: 'Push token saved successfully' };
    } catch (err: any) {
      this.logger.error(`Error saving push token for user [${userId}]: ${err?.message || err}`);
      return { success: false, message: err?.message || 'Error saving token' };
    }
  }

  /**
   * Bắn thông báo đẩy Remote Push Notification (FCM qua Expo Push Service)
   */
  private async sendRemotePush(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      const activeTokens = await this.deviceTokenRepo.find({
        where: { userId, isActive: true },
      });

      if (!activeTokens || activeTokens.length === 0) {
        return;
      }

      const messages = activeTokens.map((t) => ({
        to: t.token,
        sound: 'default',
        title: title || 'UniTime Notification ⭐',
        body: body || '',
        data: data || {},
        priority: 'high',
        channelId: 'default',
      }));

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const responseData = await res.json();
      this.logger.log(`Dispatched remote push to user [${userId}]: ${JSON.stringify(responseData)}`);
    } catch (pushErr: any) {
      this.logger.warn(`Remote push error for user [${userId}]: ${pushErr?.message || pushErr}`);
    }
  }

  /**
   * Lấy danh sách thông báo trong Hộp thư của người dùng kèm số lượng chưa đọc
   */
  async getMyNotifications(
    recipientId: string,
    limit = 20,
    unreadOnly = false,
    page = 1,
  ): Promise<GetMyNotificationsResponseDto> {
    const whereCondition: any = { recipientId };
    if (unreadOnly) {
      whereCondition.isRead = false;
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);

    const [items, total] = await this.inboxRepo.findAndCount({
      where: whereCondition,
      relations: { notification: true },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    const unreadCount = await this.inboxRepo.count({
      where: { recipientId, isRead: false },
    });

    return {
      items: items as any,
      total,
      unreadCount,
    };
  }

  /**
   * Lấy số lượng thông báo chưa đọc
   */
  async getUnreadCount(recipientId: string): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.inboxRepo.count({
      where: { recipientId, isRead: false },
    });
    return { unreadCount };
  }

  /**
   * Đánh dấu 1 thông báo đã đọc
   */
  async markAsRead(recipientId: string, inboxId: string): Promise<NotificationInbox> {
    const inbox = await this.inboxRepo.findOne({
      where: { id: inboxId, recipientId },
      relations: { notification: true },
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
  async markAllAsRead(recipientId: string): Promise<{ success: boolean; message: string }> {
    await this.inboxRepo.update(
      { recipientId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }

  /**
   * Xóa một thông báo khỏi hộp thư
   */
  async deleteNotification(recipientId: string, inboxId: string): Promise<{ success: boolean }> {
    const inbox = await this.inboxRepo.findOne({
      where: { id: inboxId, recipientId },
    });
    if (!inbox) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    await this.inboxRepo.remove(inbox);
    return { success: true };
  }
}
