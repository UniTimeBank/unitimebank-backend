import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('mentor_recurring_schedule')
export class MentorRecurringSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @Column({ name: 'day_of_week' })
  dayOfWeek: string;

  @Column({ name: 'start_time' })
  startTime: string;

  @Column({ name: 'end_time' })
  endTime: string;

  @Column({ name: 'duration_minutes' })
  durationMinutes: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
