import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { OtpPurpose } from '../enums';

@Entity('otp_record')
export class OtpRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  code: string;

  @Column({ type: 'enum', enum: OtpPurpose, name: 'purpose' })
  purpose: OtpPurpose;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: false })
  consumed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
