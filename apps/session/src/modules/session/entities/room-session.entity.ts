import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { RoomType, RoomStatus, RoomCloseReason } from '../enums';
import { RoomParticipant } from './room-participant.entity';
import { RoomChatMessage } from './room-chat-message.entity';
import { AfkDetection } from './afk-detection.entity';
import { TrialLessonUsage } from './trial-lesson-usage.entity';
import { ScreenRecording } from './screen-recording.entity';
import { HostAction } from './host-action.entity';
import { ConnectionEvent } from './connection-event.entity';

@Entity('room_session')
export class RoomSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: RoomType, name: 'room_type' })
  roomType: RoomType;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @Column({ name: 'learner_id', nullable: true })
  learnerId: string;

  @Column({ name: 'booking_id', nullable: true })
  bookingId: string;

  @Column({ name: 'livekit_room_name', nullable: true })
  livekitRoomName: string;

  @Column({ type: 'enum', enum: RoomStatus, default: RoomStatus.SCHEDULED })
  status: RoomStatus;

  @Column({ name: 'scheduled_start', type: 'timestamptz', nullable: true })
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'timestamptz', nullable: true })
  scheduledEnd: Date;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date;

  @Column({ type: 'enum', enum: RoomCloseReason, nullable: true })
  closeReason: RoomCloseReason;

  @OneToMany(() => RoomParticipant, (p) => p.roomSession)
  participants: RoomParticipant[];

  @OneToMany(() => RoomChatMessage, (m) => m.roomSession)
  messages: RoomChatMessage[];

  @OneToMany(() => AfkDetection, (a) => a.roomSession)
  afkDetections: AfkDetection[];

  @OneToMany(() => TrialLessonUsage, (t) => t.roomSession)
  trialUsages: TrialLessonUsage[];

  @OneToMany(() => ScreenRecording, (s) => s.roomSession)
  recordings: ScreenRecording[];

  @OneToMany(() => HostAction, (h) => h.roomSession)
  hostActions: HostAction[];

  @OneToMany(() => ConnectionEvent, (c) => c.roomSession)
  connectionEvents: ConnectionEvent[];
}
