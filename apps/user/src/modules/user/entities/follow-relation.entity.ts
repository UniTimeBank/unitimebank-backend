import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';

@Entity('follow_relation')
export class FollowRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'follower_id' })
  followerId: string;

  @ManyToOne(() => UserProfile, (profile) => profile.following, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id', referencedColumnName: 'userId' })
  follower: UserProfile;

  @Column({ name: 'followee_id' })
  followeeId: string;

  @ManyToOne(() => UserProfile, (profile) => profile.followers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followee_id', referencedColumnName: 'userId' })
  followee: UserProfile;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
