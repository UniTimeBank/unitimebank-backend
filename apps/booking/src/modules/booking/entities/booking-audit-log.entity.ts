import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { BookingStatus, BookingAction } from '../enums';

@Entity('booking_audit_log')
export class BookingAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.auditLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ name: 'actor_id' })
  actorId: string;

  @Column({ type: 'enum', enum: BookingAction })
  action: BookingAction;

  @Column({ type: 'enum', enum: BookingStatus, nullable: true })
  fromStatus: BookingStatus;

  @Column({ type: 'enum', enum: BookingStatus, nullable: true })
  toStatus: BookingStatus;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
