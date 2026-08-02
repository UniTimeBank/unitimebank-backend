import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { UserSkill } from './user-skill.entity';
import { FollowRelation } from './follow-relation.entity';
import { LoginStreak } from './login-streak.entity';
import { OnboardingReward } from './onboarding-reward.entity';

@Entity('user_profile')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'display_name', nullable: true })
  displayName: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ name: 'trust_score', default: 100 })
  trustScore: number;

  @Column({ name: 'onboarding_completed', default: false })
  onboardingCompleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => UserSkill, (skill) => skill.userProfile)
  skills: UserSkill[];

  @OneToMany(() => FollowRelation, (follow) => follow.follower)
  following: FollowRelation[];

  @OneToMany(() => FollowRelation, (follow) => follow.followee)
  followers: FollowRelation[];

  @OneToMany(() => LoginStreak, (streak) => streak.userProfile)
  loginStreaks: LoginStreak[];

  @OneToMany(() => OnboardingReward, (reward) => reward.userProfile)
  onboardingRewards: OnboardingReward[];
}
