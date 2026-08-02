import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '@app/common';
import { UserProfile, SkillCategory, UserSkill, FollowRelation, LoginStreak, OnboardingReward } from './modules/user/entities';
import {
  UserProfileService,
  UserProfileController,
  UserSkillService,
  UserSkillController,
  UserSkillCategoryService,
  UserSkillCategoryController,
  UserEventHandler,
} from './modules/user';

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
      database: process.env.DB_NAME || 'user_db',
      entities: [UserProfile, SkillCategory, UserSkill, FollowRelation, LoginStreak, OnboardingReward],
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
    ]),
  ],
  controllers: [
    UserProfileController,
    UserSkillController,
    UserSkillCategoryController,
    UserEventHandler,
  ],
  providers: [
    UserProfileService,
    UserSkillService,
    UserSkillCategoryService,
  ],
  exports: [
    UserProfileService,
    UserSkillService,
    UserSkillCategoryService,
  ],
})
export class UserModule {}
