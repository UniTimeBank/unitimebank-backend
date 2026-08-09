import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';

@Entity('login_streak')
export class LoginStreak {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserProfile, (profile) => profile.loginStreaks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  userProfile: UserProfile;

  @Column({ name: 'login_date', type: 'date' })
  loginDate: Date;

  @Column({ name: 'streak_day', default: 1 })
  streakDay: number;

  @Column({ name: 'reward_granted', default: false })
  rewardGranted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
