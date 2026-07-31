import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EvidenceKind } from '../enums';
import { ViolationReport } from './violation-report.entity';

@Entity('report_evidence')
export class ReportEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => ViolationReport, (report) => report.evidences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: ViolationReport;

  @Column({ name: 'recording_id', nullable: true })
  recordingId: string;

  @Column({ name: 'cloudinary_public_id', nullable: true })
  cloudinaryPublicId: string;

  @Column({ type: 'enum', enum: EvidenceKind })
  kind: EvidenceKind;

  @Column({ name: 'size_bytes', default: 0 })
  sizeBytes: number;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
