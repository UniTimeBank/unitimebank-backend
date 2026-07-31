import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import {
  RoomSession, RoomParticipant, RoomChatMessage, HeartbeatTick, AfkDetection, TrialLessonUsage,
  ScreenRecording, HostAction, ConnectionEvent
} from './modules/session/entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'session_db',
      entities: [RoomSession, RoomParticipant, RoomChatMessage, HeartbeatTick, AfkDetection, TrialLessonUsage, ScreenRecording, HostAction, ConnectionEvent],
      synchronize: true,
      ssl: process.env.DB_SSL === 'true',
      extra: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {},
    }),
  ],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
