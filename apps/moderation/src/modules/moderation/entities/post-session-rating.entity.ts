import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('post_session_rating')
export class PostSessionRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id', nullable: true })
  bookingId?: string;

  @Column({ name: 'room_id', nullable: true })
  roomId?: string;

  @Column({ name: 'session_type', default: 'ONE_ON_ONE' })
  sessionType?: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId?: string;

  @Column({ name: 'learner_id' })
  learnerId: string;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @Column({ name: 'mentor_name', nullable: true })
  mentorName?: string;

  @Column({ name: 'mentor_avatar', nullable: true })
  mentorAvatar?: string;

  @Column()
  stars: number;

  @Column({ nullable: true })
  comment?: string;

  @Column({ name: 'reviewer_name', nullable: true })
  reviewerName?: string;

  @Column({ name: 'reviewer_avatar', nullable: true })
  reviewerAvatar?: string;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;
}
