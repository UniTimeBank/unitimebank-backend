import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DeliveryChannel, DeliveryStatus, FailureReason } from '../enums';
import { Notification } from './notification.entity';

@Entity('notification_delivery')
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id' })
  notificationId: string;

  @ManyToOne(() => Notification, (n) => n.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  @Column({ type: 'enum', enum: DeliveryChannel })
  channel: DeliveryChannel;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING })
  status: DeliveryStatus;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date;

  @Column({ type: 'enum', enum: FailureReason, default: FailureReason.NONE })
  failureReason: FailureReason;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;
}
