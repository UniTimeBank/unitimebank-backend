import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany,
} from 'typeorm';
import { BookingStatus, CancellationReason } from '../enums';
import { BookingMessage } from './booking-message.entity';
import { BookingChatState } from './booking-chat-state.entity';
import { BookingReminder } from './booking-reminder.entity';
import { BookingAuditLog } from './booking-audit-log.entity';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @Column({ name: 'learner_id' })
  learnerId: string;

  @Column({ name: 'mentor_post_id' })
  mentorPostId: string;

  @Column({ name: 'scheduled_start', type: 'timestamptz' })
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'timestamptz' })
  scheduledEnd: Date;

  @Column({ name: 'total_credit_escrowed' })
  totalCreditEscrowed: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'enum', enum: CancellationReason, nullable: true })
  cancellationReason: CancellationReason;

  @Column({ name: 'cancelled_by', nullable: true })
  cancelledBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => BookingMessage, (msg) => msg.booking)
  messages: BookingMessage[];

  @OneToMany(() => BookingChatState, (chat) => chat.booking)
  chatState: BookingChatState[];

  @OneToMany(() => BookingReminder, (reminder) => reminder.booking)
  reminders: BookingReminder[];

  @OneToMany(() => BookingAuditLog, (log) => log.booking)
  auditLogs: BookingAuditLog[];
}
