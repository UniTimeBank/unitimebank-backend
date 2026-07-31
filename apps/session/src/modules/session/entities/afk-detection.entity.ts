import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AfkSource, AfkOutcome } from '../enums';
import { RoomSession } from './room-session.entity';

@Entity('afk_detection')
export class AfkDetection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => RoomSession, (room) => room.afkDetections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  roomSession: RoomSession;

  @Column({ name: 'participant_id' })
  participantId: string;

  @Column({ type: 'enum', enum: AfkSource })
  source: AfkSource;

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;

  @Column({ name: 'countdown_deadline', type: 'timestamptz', nullable: true })
  countdownDeadline: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'enum', enum: AfkOutcome, default: AfkOutcome.PENDING })
  resolvedOutcome: AfkOutcome;
}
