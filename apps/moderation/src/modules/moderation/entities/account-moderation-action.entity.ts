import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { AccountModerationType } from '../enums';

@Entity('account_moderation_action')
export class AccountModerationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'actor_id' })
  actorId: string;

  @Column({ type: 'enum', enum: AccountModerationType, name: 'action_type' })
  actionType: AccountModerationType;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date;
}
