import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { SkillCategoryName } from '../enums';
import { UserSkill } from './user-skill.entity';

@Entity('skill_category')
export class SkillCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SkillCategoryName, unique: true })
  name: SkillCategoryName;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @OneToMany(() => UserSkill, (skill) => skill.category)
  userSkills: UserSkill[];
}
