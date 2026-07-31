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

  @Column({ type: 'enum', enum: TrustTier, default: TrustTier.GOOD })
  tier: TrustTier;

  @VersionColumn()
  version: number;

  @UpdateDateColumn({ name: 'last_updated_at' })
  lastUpdatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => TrustScoreChange, (change) => change.trustScore)
  scoreChanges: TrustScoreChange[];
}
