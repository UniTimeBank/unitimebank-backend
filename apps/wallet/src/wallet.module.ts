import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Wallet, CreditLedgerEntry, EscrowHold, SessionCharge, RewardGrant, LowBalanceAlert } from './modules/wallet/entities';

import { WalletAccountService } from './modules/wallet/wallet-account/wallet-account.service';
import { WalletAccountController } from './modules/wallet/wallet-account/wallet-account.controller';

import { WalletLedgerService } from './modules/wallet/wallet-ledger/wallet-ledger.service';
import { WalletLedgerController } from './modules/wallet/wallet-ledger/wallet-ledger.controller';

import { WalletEscrowService } from './modules/wallet/wallet-escrow/wallet-escrow.service';
import { WalletEscrowController } from './modules/wallet/wallet-escrow/wallet-escrow.controller';

import { WalletTransactionService } from './modules/wallet/wallet-transaction/wallet-transaction.service';
import { WalletTransactionController } from './modules/wallet/wallet-transaction/wallet-transaction.controller';

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
    TypeOrmModule.forFeature([Wallet, CreditLedgerEntry, EscrowHold, SessionCharge, RewardGrant, LowBalanceAlert]),
  ],
  controllers: [
    WalletAccountController,
    WalletLedgerController,
    WalletEscrowController,
    WalletTransactionController,
  ],
  providers: [
    WalletAccountService,
    WalletLedgerService,
    WalletEscrowService,
    WalletTransactionService,
  ],
})
export class WalletModule {}
