import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('mentor_exception_date')
export class MentorExceptionDate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @Column({ name: 'exception_date', type: 'date' })
  exceptionDate: string;

  @Column()
  type: string;

  @Column({ name: 'start_time' })
  startTime: string;

  @Column({ name: 'end_time' })
  endTime: string;

  @Column({ name: 'duration_minutes' })
  durationMinutes: number;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
