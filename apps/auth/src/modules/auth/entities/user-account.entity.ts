import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role, AccountStatus } from '../enums';
import { RefreshToken } from './refresh-token.entity';
import { AuthSession } from './auth-session.entity';

@Entity('user_account')
export class UserAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.PENDING_VERIFY })
  status: AccountStatus;

  @Column({ name: 'trust_score', default: 100 })
  trustScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (token) => token.userAccount)
  refreshTokens: RefreshToken[];

  @OneToMany(() => AuthSession, (session) => session.userAccount)
  authSessions: AuthSession[];
}
