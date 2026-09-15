import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, VersionColumn } from 'typeorm';
import { TrustTier } from '../enums';
import { TrustScoreChange } from './trust-score-change.entity';

@Entity('trust_score')
export class TrustScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ default: 100 })
  score: number;

  @Column({ name: 'mentor_score', default: 100 })
  mentorScore: number;

  @Column({ name: 'learner_score', default: 100 })
  learnerScore: number;

  @Column({ type: 'enum', enum: TrustTier, default: TrustTier.GOOD })
  tier: TrustTier;

  @Column({ name: 'mentor_tier', type: 'enum', enum: TrustTier, default: TrustTier.GOOD })
  mentorTier: TrustTier;

  @Column({ name: 'learner_tier', type: 'enum', enum: TrustTier, default: TrustTier.GOOD })
  learnerTier: TrustTier;


  @VersionColumn()
  version: number;

  @UpdateDateColumn({ name: 'last_updated_at', type: 'timestamptz' })
  lastUpdatedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => TrustScoreChange, (change) => change.trustScore)
  scoreChanges: TrustScoreChange[];
}
