import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CloudinaryModule } from '@app/common/cloudinary';
import { LiveKitModule } from '@app/common/livekit';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import {
  RoomSession,
  RoomParticipant,
  RoomChatMessage,
  HeartbeatTick,
  AfkDetection,
  TrialLessonUsage,
  ScreenRecording,
  HostAction,
  ConnectionEvent,
} from './modules/session/entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CloudinaryModule,
    LiveKitModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.SESSION_DB_NAME || 'session_db',
      entities: [
        RoomSession,
        RoomParticipant,
        RoomChatMessage,
        HeartbeatTick,
        AfkDetection,
        TrialLessonUsage,
        ScreenRecording,
        HostAction,
        ConnectionEvent,
      ],
      synchronize: true,
      ssl: process.env.DB_SSL === 'true',
      extra: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {},
    }),
    TypeOrmModule.forFeature([
      RoomSession,
      RoomParticipant,
      RoomChatMessage,
      HeartbeatTick,
      AfkDetection,
      TrialLessonUsage,
      ScreenRecording,
      HostAction,
      ConnectionEvent,
    ]),
    ClientsModule.register([
      {
        name: 'WALLET_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'wallet_queue',
          queueOptions: { durable: false },
        },
      },
      {
        name: 'BOOKING_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'booking_queue',
          queueOptions: { durable: false },
        },
      },
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'notification_queue',
          queueOptions: { durable: false },
        },
      },
      {
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'user_queue',
          queueOptions: { durable: false },
        },
      },
      {
        name: 'POST_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'post_queue',
          queueOptions: { durable: false },
        },
      },
    ]),
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
