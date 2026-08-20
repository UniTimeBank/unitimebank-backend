import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '@app/common';
import { NotificationModule as NotificationFeatureModule } from './modules/notification';
import {
  Notification,
  NotificationDelivery,
  NotificationInbox,
  NotificationPreference,
  ReminderSchedule,
  EventSubscription,
} from './modules/notification/entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'notification_db',
      entities: [
        Notification,
        NotificationDelivery,
        NotificationInbox,
        NotificationPreference,
        ReminderSchedule,
        EventSubscription,
      ],
      synchronize: true,
      ssl: process.env.DB_SSL === 'true',
      extra: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {},
    }),
    NotificationFeatureModule,
  ],
})
export class NotificationModule {}
