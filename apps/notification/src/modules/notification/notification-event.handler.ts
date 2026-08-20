import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  POST_EVENTS,
  USER_EVENTS,
  NOTIFICATION_EVENTS,
} from '@app/contracts/events';
import type {
  CreateNotificationEvent,
  PostCreatedEvent,
  UserCheckinStreakEvent,
  UserRegisteredEvent,
} from '@app/contracts/events';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Lắng nghe event tạo thông báo chung
   */
  @EventPattern(NOTIFICATION_EVENTS.CREATE)
  async handleCreateNotification(@Payload() data: CreateNotificationEvent) {
    this.logger.log(
      `[EVENT] Received ${NOTIFICATION_EVENTS.CREATE} for user ${data?.userId}: "${data?.title}"`
    );
    if (!data?.userId) return;
    try {
      await this.notificationService.createNotification(data);
    } catch (err) {
      this.logger.error(`Failed to handle ${NOTIFICATION_EVENTS.CREATE}:`, err);
    }
  }

  /**
   * Lắng nghe event khi có bài viết/lớp học mới từ Mentor
   */
  @EventPattern(POST_EVENTS.POST_CREATED)
  async handlePostCreated(@Payload() data: PostCreatedEvent) {
    this.logger.log(
      `[EVENT] Received ${POST_EVENTS.POST_CREATED} for post ID: ${data?.postId} by mentor ${data?.mentorName}`
    );
  }

  /**
   * Lắng nghe event hoàn thành streak điểm danh
   */
  @EventPattern(USER_EVENTS.USER_CHECKIN_STREAK)
  async handleCheckinStreak(@Payload() data: UserCheckinStreakEvent) {
    this.logger.log(
      `[EVENT] Received ${USER_EVENTS.USER_CHECKIN_STREAK} for user ${data?.userId} (Day ${data?.streakDay}, +${data?.rewardCredits} Credits)`
    );
  }

  /**
   * Lắng nghe event đăng ký tài khoản thành công
   */
  @EventPattern(USER_EVENTS.USER_REGISTERED)
  async handleUserRegistered(@Payload() data: UserRegisteredEvent) {
    this.logger.log(`[EVENT] Received ${USER_EVENTS.USER_REGISTERED} for user ${data?.userId}`);
  }
}
