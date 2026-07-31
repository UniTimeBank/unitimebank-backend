import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('system_stats')
export class SystemStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'snapshot_date', type: 'date' })
  snapshotDate: Date;

  @Column({ name: 'total_users', default: 0 })
  totalUsers: number;

  @Column({ name: 'total_active_learners', default: 0 })
  totalActiveLearners: number;

  @Column({ name: 'total_active_mentors', default: 0 })
  totalActiveMentors: number;

  @Column({ name: 'total_bookings', default: 0 })
  totalBookings: number;

  @Column({ name: 'total_credits_circulated', default: 0 })
  totalCreditsCirculated: number;

  @Column({ name: 'open_reports', default: 0 })
  openReports: number;

  @Column({ type: 'simple-array', name: 'top_mentor_ids', nullable: true })
  topMentorIds: string[];

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;
}
