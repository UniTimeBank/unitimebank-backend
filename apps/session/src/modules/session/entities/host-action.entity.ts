import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { HostActionType } from '../enums';
import { RoomSession } from './room-session.entity';

@Entity('host_action')
export class HostAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => RoomSession, (room) => room.hostActions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  roomSession: RoomSession;

  @Column({ name: 'actor_id' })
  actorId: string;

  @Column({ type: 'enum', enum: HostActionType, name: 'action_type' })
  actionType: HostActionType;

  @Column({ name: 'target_user_id', nullable: true })
  targetUserId: string;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
