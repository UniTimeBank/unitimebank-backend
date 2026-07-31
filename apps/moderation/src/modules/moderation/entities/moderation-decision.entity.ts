import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ModerationDecisionType } from '../enums';
import { ViolationReport } from './violation-report.entity';

@Entity('moderation_decision')
export class ModerationDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => ViolationReport, (report) => report.decisions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: ViolationReport;

  @Column({ name: 'moderator_id' })
  moderatorId: string;

  @Column({ type: 'enum', enum: ModerationDecisionType })
  decision: ModerationDecisionType;

  @Column({ name: 'trust_delta', default: 0 })
  trustDelta: number;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'decided_at' })
  decidedAt: Date;
}
