import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommonModule } from '@app/common';
import { CloudinaryModule } from '@app/common/cloudinary';
import {
  UserProfile,
  SkillCategory,
  UserSkill,
  FollowRelation,
  LoginStreak,
  OnboardingReward,
  MentorRecurringSchedule,
  MentorExceptionDate,
} from './modules/user/entities';
import {
  UserProfileService,
  UserProfileController,
  UserSkillService,
  UserSkillController,
  UserSkillCategoryService,
  UserSkillCategoryController,
  UserAvatarService,
  UserAvatarController,
  UserFollowService,
  UserFollowController,
  UserCheckinService,
  UserCheckinController,
  UserScheduleService,
  UserScheduleController,
  UserEventHandler,
} from './modules/user';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    CloudinaryModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'user_db',
      entities: [
        UserProfile,
        SkillCategory,
        UserSkill,
        FollowRelation,
        LoginStreak,
        OnboardingReward,
        MentorRecurringSchedule,
        MentorExceptionDate,
      ],
      synchronize: true,
      ssl: process.env.DB_SSL === 'true',
      extra: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {},
    }),
    TypeOrmModule.forFeature([
      UserProfile,
      SkillCategory,
      UserSkill,
      FollowRelation,
      LoginStreak,
      OnboardingReward,
      MentorRecurringSchedule,
      MentorExceptionDate,
    ]),
    ClientsModule.register([
      {
        name: 'WALLET_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'wallet_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [
    UserProfileController,
    UserSkillController,
    UserSkillCategoryController,
    UserAvatarController,
    UserFollowController,
    UserCheckinController,
    UserScheduleController,
    UserEventHandler,
  ],
  providers: [
    UserProfileService,
    UserSkillService,
    UserSkillCategoryService,
    UserAvatarService,
    UserFollowService,
    UserCheckinService,
    UserScheduleService,
  ],
  exports: [
    UserProfileService,
    UserSkillService,
    UserSkillCategoryService,
    UserAvatarService,
    UserFollowService,
    UserCheckinService,
    UserScheduleService,
  ],
})
export class UserModule {}
