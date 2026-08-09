import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { SkillCategoryName } from '../enums';
import { UserProfile } from './user-profile.entity';

@Entity('user_skill')
export class UserSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserProfile, (profile) => profile.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  userProfile: UserProfile;

  @Column({ name: 'skill_name' })
  skillName: string;

  @Column({ type: 'enum', enum: SkillCategoryName })
  category: SkillCategoryName;

  @Column({ name: 'is_strong', default: false })
  isStrong: boolean;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;
}
