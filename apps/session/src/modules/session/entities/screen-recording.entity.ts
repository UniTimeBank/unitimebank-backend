import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RecordingStatus } from '../enums';
import { RoomSession } from './room-session.entity';

@Entity('screen_recording')
export class ScreenRecording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => RoomSession, (room) => room.recordings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  roomSession: RoomSession;

  @Column({ name: 'recorder_id' })
  recorderId: string;

  @Column({ name: 'cloudinary_public_id', nullable: true })
  cloudinaryPublicId: string;

  @Column({ name: 'size_bytes', default: 0 })
  sizeBytes: number;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date;

  @Column({ type: 'enum', enum: RecordingStatus, default: RecordingStatus.RECORDING })
  status: RecordingStatus;
}
