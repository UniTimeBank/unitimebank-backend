import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EventType } from '../enums';
import { RoomSession } from './room-session.entity';

@Entity('connection_event')
export class ConnectionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => RoomSession, (room) => room.connectionEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  roomSession: RoomSession;

  @Column({ name: 'participant_id' })
  participantId: string;

  @Column({ type: 'enum', enum: EventType, name: 'event_type' })
  eventType: EventType;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;

  @Column({ nullable: true })
  detail: string;
}
