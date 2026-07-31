import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import {
  TrustScore, TrustScoreChange, PostSessionRating, ViolationReport,
  ReportEvidence, ModerationDecision, AccountModerationAction, SystemStats
} from './modules/moderation/entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'moderation_db',
      entities: [TrustScore, TrustScoreChange, PostSessionRating, ViolationReport, ReportEvidence, ModerationDecision, AccountModerationAction, SystemStats],
      synchronize: true,
      ssl: process.env.DB_SSL === 'true',
      extra: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {},
    }),
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
