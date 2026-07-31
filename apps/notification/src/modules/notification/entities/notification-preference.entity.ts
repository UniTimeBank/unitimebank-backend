import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { NotificationKind } from '../enums';

@Entity('notification_preference')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'push_enabled', default: true })
  pushEnabled: boolean;

  @Column({ name: 'in_app_enabled', default: true })
  inAppEnabled: boolean;

  @Column({ name: 'email_enabled', default: false })
  emailEnabled: boolean;

  @Column({ type: 'simple-array', name: 'muted_kinds', nullable: true })
  mutedKinds: NotificationKind[];

  @Column({ name: 'low_balance_threshold', default: 10 })
  lowBalanceThreshold: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
