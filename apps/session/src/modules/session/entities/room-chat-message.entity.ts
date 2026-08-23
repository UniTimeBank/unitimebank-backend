import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { RoomSession } from './room-session.entity';

@Entity('room_chat_message')
export class RoomChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => RoomSession, (room) => room.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  roomSession: RoomSession;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ nullable: true, default: '' })
  content: string;

  @Column({ name: 'attachment_url', nullable: true })
  attachmentUrl?: string;

  @Column({ name: 'attachment_name', nullable: true })
  attachmentName?: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
