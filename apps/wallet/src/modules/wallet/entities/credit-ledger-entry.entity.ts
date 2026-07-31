import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { LedgerDirection, EntryType, ReferenceKind } from '../enums';
import { Wallet } from './wallet.entity';

@Entity('credit_ledger_entry')
export class CreditLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.ledgerEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: LedgerDirection })
  direction: LedgerDirection;

  @Column({ type: 'enum', enum: EntryType, name: 'entry_type' })
  entryType: EntryType;

  @Column()
  amount: number;

  @Column({ name: 'balance_after' })
  balanceAfter: number;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ type: 'enum', enum: ReferenceKind, name: 'reference_kind', nullable: true })
  referenceKind: ReferenceKind;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
