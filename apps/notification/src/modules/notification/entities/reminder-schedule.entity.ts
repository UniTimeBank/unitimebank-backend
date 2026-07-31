import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reminder_schedule')
export class ReminderSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ name: 'fire_at', type: 'timestamptz' })
  fireAt: Date;

  @Column({ default: false })
  dispatched: boolean;

  @Column({ name: 'dispatched_at', type: 'timestamptz', nullable: true })
  dispatchedAt: Date;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;
}
