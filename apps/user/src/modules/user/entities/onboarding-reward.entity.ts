import {
  Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { RewardType } from '../enums';
import { UserProfile } from './user-profile.entity';

@Entity('onboarding_reward')
export class OnboardingReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserProfile, (profile) => profile.onboardingRewards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  userProfile: UserProfile;

  @Column({ type: 'enum', enum: RewardType, name: 'reward_type' })
  rewardType: RewardType;

  @Column({ name: 'credit_amount' })
  creditAmount: number;

  @CreateDateColumn({ name: 'granted_at' })
  grantedAt: Date;
}
