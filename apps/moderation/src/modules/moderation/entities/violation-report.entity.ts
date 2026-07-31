import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn } from 'typeorm';
import { ReportTargetType, ReportCategory, ReportStatus } from '../enums';
import { ReportEvidence } from './report-evidence.entity';
import { ModerationDecision } from './moderation-decision.entity';

@Entity('violation_report')
export class ViolationReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reporter_id' })
  reporterId: string;

  @Column({ name: 'target_user_id' })
  targetUserId: string;

  @Column({ type: 'enum', enum: ReportTargetType, name: 'target_type' })
  targetType: ReportTargetType;

  @Column({ name: 'target_id' })
  targetId: string;

  @Column({ type: 'enum', enum: ReportCategory })
  category: ReportCategory;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.OPEN })
  status: ReportStatus;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date;

  @OneToMany(() => ReportEvidence, (e) => e.report)
  evidences: ReportEvidence[];

  @OneToMany(() => ModerationDecision, (d) => d.report)
  decisions: ModerationDecision[];
}
