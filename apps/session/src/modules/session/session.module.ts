import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
} from './entities';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CloudinaryModule,
    LiveKitModule,
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
export class SessionFeatureModule {}
