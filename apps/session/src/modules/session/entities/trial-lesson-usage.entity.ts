import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RoomSession } from './room-session.entity';
import { RoomParticipant } from './room-participant.entity';

@Entity('trial_lesson_usage')
export class TrialLessonUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => RoomSession, (room) => room.trialUsages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  roomSession: RoomSession;

  @Column({ name: 'participant_id' })
  participantId: string;

  @ManyToOne(() => RoomParticipant, (p) => p.trialUsages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant: RoomParticipant;

  @Column({ name: 'used_at', type: 'timestamptz' })
  usedAt: Date;

  @Column({ name: 'refunded_credit', default: 0 })
  refundedCredit: number;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date;
}
