import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { CloseReason } from '../enums';

@Entity('booking_chat_state')
export class BookingChatState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', unique: true })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.chatState, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ name: 'is_open', default: true })
  isOpen: boolean;

  @Column({ name: 'read_only', default: false })
  readOnly: boolean;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date;

  @Column({ type: 'enum', enum: CloseReason, nullable: true })
  closeReason: CloseReason;
}
