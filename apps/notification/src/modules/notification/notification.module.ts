import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Notification,
  NotificationDelivery,
  NotificationInbox,
  NotificationPreference,
  ReminderSchedule,
  EventSubscription,
} from './entities';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationEventHandler } from './notification-event.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationDelivery,
      NotificationInbox,
      NotificationPreference,
      ReminderSchedule,
      EventSubscription,
    ]),
  ],
  controllers: [NotificationController, NotificationEventHandler],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
