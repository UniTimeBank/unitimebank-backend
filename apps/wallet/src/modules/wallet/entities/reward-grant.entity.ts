import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { RewardGrantType, SourceEvent } from '../enums';
import { Wallet } from './wallet.entity';

@Entity('reward_grant')
export class RewardGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.rewardGrants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: RewardGrantType, name: 'reward_type' })
  rewardType: RewardGrantType;

  @Column()
  amount: number;

  @Column({ type: 'enum', enum: SourceEvent, name: 'source_event' })
  sourceEvent: SourceEvent;

  @CreateDateColumn({ name: 'granted_at' })
  grantedAt: Date;

  @Column({ name: 'ledger_entry_id', nullable: true })
  ledgerEntryId: string;
}
