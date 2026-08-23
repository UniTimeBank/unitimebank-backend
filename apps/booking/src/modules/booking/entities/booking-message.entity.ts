import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Booking } from './booking.entity';

@Entity('booking_message')
export class BookingMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ default: 'TEXT' })
  type: string; // 'TEXT' | 'IMAGE' | 'FILE' | 'LINK' | 'SYSTEM'

  @Column()
  content: string;

  @Column({ name: 'attachment_url', nullable: true })
  attachmentUrl: string;

  @Column({ name: 'attachment_name', nullable: true })
  attachmentName: string;

  @Column({ name: 'attachment_size', type: 'bigint', nullable: true })
  attachmentSize: number;

  @Column({ name: 'attachment_mime', nullable: true })
  attachmentMime: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date;
}
