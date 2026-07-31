import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Wallet } from './wallet.entity';

@Entity('low_balance_alert')
export class LowBalanceAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.lowBalanceAlerts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'balance_at_trigger' })
  balanceAtTrigger: number;

  @CreateDateColumn({ name: 'triggered_at' })
  triggeredAt: Date;

  @Column({ name: 'suppressed_until', type: 'timestamptz', nullable: true })
  suppressedUntil: Date;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt: Date;
}
