import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RoomParticipant } from './room-participant.entity';

@Entity('heartbeat_tick')
export class HeartbeatTick {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'participant_id' })
  participantId: string;

  @ManyToOne(() => RoomParticipant, (p) => p.heartbeatTicks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant: RoomParticipant;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({ name: 'tick_at', type: 'timestamptz' })
  tickAt: Date;

  @Column({ name: 'credit_deducted', default: false })
  creditDeducted: boolean;

  @Column({ name: 'emitted_at', type: 'timestamptz' })
  emittedAt: Date;
}
