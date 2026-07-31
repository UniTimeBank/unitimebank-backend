import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('session_charge')
export class SessionCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id' })
  roomId: string;

  @Column({ name: 'learner_id' })
  learnerId: string;

  @Column({ name: 'mentor_id' })
  mentorId: string;

  @Column({ name: 'minutes_charged' })
  minutesCharged: number;

  @CreateDateColumn({ name: 'charged_at' })
  chargedAt: Date;

  @Column({ name: 'ledger_entry_id', nullable: true })
  ledgerEntryId: string;
}
