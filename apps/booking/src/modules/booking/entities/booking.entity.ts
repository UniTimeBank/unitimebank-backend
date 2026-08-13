import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { BookingMessage } from './booking-message.entity';
import { BookingChatState } from './booking-chat-state.entity';
import { BookingReminder } from './booking-reminder.entity';
import { BookingAuditLog } from './booking-audit-log.entity';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'origin', type: 'varchar', default: 'MENTOR_POST' })
  origin: string; // 'MENTOR_POST' | 'LEARNER_REQUEST'

  @Column({ name: 'source_post_id', nullable: true })
  sourcePostId: string;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @Column({ name: 'mentor_name', nullable: true })
  mentorName: string;

  @Column({ name: 'mentor_avatar', nullable: true })
  mentorAvatar: string;

  @Column({ name: 'learner_id' })
  learnerId: string;

  @Column({ name: 'learner_name', nullable: true })
  learnerName: string;

  @Column({ name: 'learner_avatar', nullable: true })
  learnerAvatar: string;

  @Column({ name: 'title', nullable: true })
  title: string;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string;

  @Column({ name: 'scheduled_start', type: 'timestamptz' })
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'timestamptz' })
  scheduledEnd: Date;

  @Column({ name: 'duration_minutes', default: 60 })
  durationMinutes: number;

  @Column({ name: 'total_credit_escrowed', default: 0 })
  totalCreditEscrowed: number;

  @Column({ name: 'status', type: 'varchar', default: 'PENDING_MENTOR_APPROVAL' })
  status: string;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason: string;

  @Column({ name: 'cancelled_by', nullable: true })
  cancelledBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => BookingMessage, (msg) => msg.booking)
  messages: BookingMessage[];

  @OneToMany(() => BookingChatState, (chat) => chat.booking)
  chatState: BookingChatState[];

  @OneToMany(() => BookingReminder, (reminder) => reminder.booking)
  reminders: BookingReminder[];

  @OneToMany(() => BookingAuditLog, (log) => log.booking)
  auditLogs: BookingAuditLog[];
}
