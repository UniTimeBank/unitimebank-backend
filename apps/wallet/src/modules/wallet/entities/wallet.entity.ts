import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, VersionColumn } from 'typeorm';
import { CreditLedgerEntry } from './credit-ledger-entry.entity';
import { EscrowHold } from './escrow-hold.entity';
import { RewardGrant } from './reward-grant.entity';
import { LowBalanceAlert } from './low-balance-alert.entity';

@Entity('wallet')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'available_balance', default: 0 })
  availableBalance: number;

  @Column({ name: 'escrowed_balance', default: 0 })
  escrowedBalance: number;

  @Column({ name: 'low_balance_threshold', default: 5 })
  lowBalanceThreshold: number;

  @Column({ name: 'total_earned', default: 0 })
  totalEarned: number;

  @Column({ name: 'total_spent', default: 0 })
  totalSpent: number;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CreditLedgerEntry, (entry) => entry.wallet)
  ledgerEntries: CreditLedgerEntry[];

  @OneToMany(() => EscrowHold, (hold) => hold.wallet)
  escrowHolds: EscrowHold[];

  @OneToMany(() => RewardGrant, (reward) => reward.wallet)
  rewardGrants: RewardGrant[];

  @OneToMany(() => LowBalanceAlert, (alert) => alert.wallet)
  lowBalanceAlerts: LowBalanceAlert[];
}
