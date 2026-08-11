import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { WalletLedgerService } from '../wallet-ledger/wallet-ledger.service';
import { LedgerDirection, EntryType, ReferenceKind } from '../enums';
import { WalletResponseDto, CheckBalanceResponseDto } from '@app/contracts/wallet';

@Injectable()
export class WalletAccountService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @Inject(forwardRef(() => WalletLedgerService))
    private readonly walletLedgerService: WalletLedgerService,
  ) {}

  /**
   * Lấy hoặc tự động khởi tạo ví mới cho User (cấp 30 Credit thưởng khởi tạo)
   */
  async findOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      wallet = this.walletRepo.create({
        userId,
        availableBalance: 30, // Số dư credit ban đầu cho tài khoản mới (30 Credit)
        escrowedBalance: 0,
        lowBalanceThreshold: 5,
        totalEarned: 30,
        totalSpent: 0,
      });
      const savedWallet = await this.walletRepo.save(wallet);

      // Ghi nhận bản ghi sổ cái khởi tạo quà 30 Credit
      try {
        await this.walletLedgerService.recordEntry({
          walletId: savedWallet.id,
          userId,
          direction: LedgerDirection.CREDIT,
          entryType: EntryType.ONBOARDING_REWARD,
          amount: 30,
          balanceAfter: 30,
          referenceId: 'user.registered',
          referenceKind: ReferenceKind.REWARD,
        });
      } catch (err) {
        console.error('[WALLET] Error recording initial ledger entry:', err);
      }

      return savedWallet;
    }
    return wallet;
  }

  /**
   * Lấy thông tin chi tiết ví dạng DTO
   */
  async getWalletResponse(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.findOrCreateWallet(userId);
    return {
      id: wallet.id,
      userId: wallet.userId,
      availableBalance: wallet.availableBalance,
      escrowedBalance: wallet.escrowedBalance,
      lowBalanceThreshold: wallet.lowBalanceThreshold,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Kiểm tra điều kiện số dư vào phòng học (GET /wallet/balance/check)
   */
  async checkBalanceForRoom(userId: string): Promise<CheckBalanceResponseDto> {
    const wallet = await this.findOrCreateWallet(userId);
    const minRequired = wallet.lowBalanceThreshold || 5;
    const canJoinRoom = wallet.availableBalance >= minRequired;
    const estimatedMinutes = Math.max(0, wallet.availableBalance);

    return {
      availableBalance: wallet.availableBalance,
      canJoinRoom,
      minRequired,
      estimatedMinutes,
    };
  }
}
