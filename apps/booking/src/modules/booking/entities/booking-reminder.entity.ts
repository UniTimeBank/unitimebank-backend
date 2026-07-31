import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { ReminderChannel } from '../enums';

@Entity('booking_reminder')
export class BookingReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.reminders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ name: 'fire_at', type: 'timestamptz' })
  fireAt: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date;

  @Column({ type: 'enum', enum: ReminderChannel, default: ReminderChannel.IN_APP })
  channel: ReminderChannel;
}
