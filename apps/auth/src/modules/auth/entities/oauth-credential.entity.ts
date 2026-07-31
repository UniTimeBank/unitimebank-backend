import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { UserAccount } from './user-account.entity';

@Entity('oauth_credential')
export class OAuthCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => UserAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  userAccount: UserAccount;

  @Column()
  provider: string;

  @Column({ name: 'provider_user_id' })
  providerUserId: string;

  @Column({ name: 'access_token_enc', nullable: true })
  accessTokenEnc: string;

  @Column({ name: 'refresh_token_enc', nullable: true })
  refreshTokenEnc: string;

  @CreateDateColumn({ name: 'linked_at' })
  linkedAt: Date;
}
