import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ParticipantRole, ConnectionStatus } from '../enums';
import { RoomSession } from './room-session.entity';
import { HeartbeatTick } from './heartbeat-tick.entity';
import { TrialLessonUsage } from './trial-lesson-usage.entity';

@Entity('room_participant')
export class RoomParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => RoomSession, (room) => room.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  roomSession: RoomSession;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: ParticipantRole })
  role: ParticipantRole;

  @Column({ name: 'joined_at', type: 'timestamptz', nullable: true })
  joinedAt: Date;

  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt: Date;

  @Column({ name: 'credit_charged', default: 0 })
  creditCharged: number;

  @Column({ name: 'active_seconds', default: 0 })
  activeSeconds: number;

  @Column({ name: 'charged_minutes', default: 0 })
  chargedMinutes: number;

  @Column({ name: 'last_heartbeat_at', type: 'timestamptz', nullable: true })
  lastHeartbeatAt: Date | null;

  @Column({ name: 'is_muted', default: false })
  isMuted: boolean;

  @Column({ name: 'is_kicked', default: false })
  isKicked: boolean;

  @Column({ type: 'enum', enum: ConnectionStatus, default: ConnectionStatus.ONLINE })
  connectionStatus: ConnectionStatus;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @OneToMany(() => HeartbeatTick, (tick) => tick.participant)
  heartbeatTicks: HeartbeatTick[];

  @OneToMany(() => TrialLessonUsage, (t) => t.participant)
  trialUsages: TrialLessonUsage[];
}
