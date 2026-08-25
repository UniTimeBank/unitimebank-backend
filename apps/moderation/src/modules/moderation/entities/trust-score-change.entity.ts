import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { TrustChangeReason } from '../enums';
import { TrustScore } from './trust-score.entity';

@Entity('trust_score_change')
export class TrustScoreChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => TrustScore, (ts) => ts.scoreChanges, {
    createForeignKeyConstraints: false,
    nullable: true,
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  trustScore: TrustScore;

  @Column()
  delta: number;

  @Column({ type: 'enum', enum: TrustChangeReason })
  reason: TrustChangeReason;

  @Column({ name: 'score_before' })
  scoreBefore: number;

  @Column({ name: 'score_after' })
  scoreAfter: number;

  @Column({ name: 'source_event_id', nullable: true })
  sourceEventId: string;

  @Column({ name: 'source_event_kind', nullable: true })
  sourceEventKind: string;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
