import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { NotificationKind } from '../enums';
import { NotificationDelivery } from './notification-delivery.entity';
import { NotificationInbox } from './notification-inbox.entity';

@Entity('notification')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ type: 'enum', enum: NotificationKind })
  kind: NotificationKind;

  @Column()
  title: string;

  @Column()
  body: string;

  @Column({ name: 'source_event', nullable: true })
  sourceEvent: string;

  @Column({ name: 'payload_ref', nullable: true })
  payloadRef: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => NotificationDelivery, (d) => d.notification)
  deliveries: NotificationDelivery[];

  @OneToMany(() => NotificationInbox, (i) => i.notification)
  inboxEntries: NotificationInbox[];
}
