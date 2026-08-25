import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  PostSessionRating,
  ViolationReport,
  ReportEvidence,
  TrustScore,
  TrustScoreChange,
  ModerationDecision,
  AccountModerationAction,
  SystemStats,
} from './entities';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { ModerationEventHandler } from './moderation-event.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PostSessionRating,
      ViolationReport,
      ReportEvidence,
      TrustScore,
      TrustScoreChange,
      ModerationDecision,
      AccountModerationAction,
      SystemStats,
    ]),
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'notification_queue',
          queueOptions: { durable: false },
        },
      },
    ]),
  ],
  controllers: [ModerationController, ModerationEventHandler],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationFeatureModule {}
