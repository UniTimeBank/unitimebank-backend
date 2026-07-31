import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EscrowStatus, ReleaseReason } from '../enums';
import { Wallet } from './wallet.entity';

@Entity('escrow_hold')
export class EscrowHold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Wallet, (wallet) => wallet.escrowHolds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column()
  amount: number;

  @Column({ type: 'enum', enum: EscrowStatus, default: EscrowStatus.HELD })
  status: EscrowStatus;

  @CreateDateColumn({ name: 'held_at' })
  heldAt: Date;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date;

  @Column({ type: 'enum', enum: ReleaseReason, nullable: true })
  releaseReason: ReleaseReason;
}
