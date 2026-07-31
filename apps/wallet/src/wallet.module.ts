import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { Wallet, CreditLedgerEntry, EscrowHold, SessionCharge, RewardGrant, LowBalanceAlert } from './modules/wallet/entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'wallet_db',
      entities: [Wallet, CreditLedgerEntry, EscrowHold, SessionCharge, RewardGrant, LowBalanceAlert],
      synchronize: true,
      ssl: process.env.DB_SSL === 'true',
      extra: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {},
    }),
  ],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
