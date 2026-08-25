import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('post_session_rating')
export class PostSessionRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column({ name: 'learner_id' })
  learnerId: string;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @Column()
  stars: number;

  @Column({ nullable: true })
  comment?: string;

  @Column({ name: 'reviewer_name', nullable: true })
  reviewerName?: string;

  @Column({ name: 'reviewer_avatar', nullable: true })
  reviewerAvatar?: string;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;
}
