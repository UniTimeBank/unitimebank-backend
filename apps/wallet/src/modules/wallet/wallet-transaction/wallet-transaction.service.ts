import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WalletAccountService } from '../wallet-account/wallet-account.service';
import { WalletLedgerService } from '../wallet-ledger/wallet-ledger.service';
import { LedgerDirection, EntryType, ReferenceKind } from '../enums';
import {
  CreditLedgerEntry,
  SessionCharge,
  Wallet,
} from '../entities';

@Injectable()
export class WalletTransactionService {
  constructor(
    private readonly walletAccountService: WalletAccountService,
    private readonly walletLedgerService: WalletLedgerService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Thưởng Credit cho User (đăng ký, streak checkin, onboarding)
   */
  async rewardCredit(data: {
    userId: string;
    rewardType: string;
    amount: number;
    sourceEvent?: string;
  }) {
    const wallet = await this.walletAccountService.findOrCreateWallet(data.userId);
    wallet.availableBalance += data.amount;
    wallet.totalEarned += data.amount;

    const savedWallet = await this.walletAccountService['walletRepo'].save(wallet);

    await this.walletLedgerService.recordEntry({
      walletId: savedWallet.id,
      userId: data.userId,
      direction: LedgerDirection.CREDIT,
      entryType: EntryType.ONBOARDING_REWARD,
      amount: data.amount,
      balanceAfter: savedWallet.availableBalance,
      referenceId: data.sourceEvent || data.rewardType,
      referenceKind: ReferenceKind.REWARD,
    });

    return savedWallet;
  }

  /**
   * Trừ Credit Heartbeat mỗi phút học (credit.deduct)
   */
  async deductHeartbeat(data: {
    roomId: string;
    learnerId: string;
    mentorId: string;
    amount: number;
    chargeKey: string;
    minuteIndex: number;
  }) {
    if (
      !data.chargeKey ||
      !Number.isInteger(data.minuteIndex) ||
      data.minuteIndex < 1 ||
      !Number.isInteger(data.amount) ||
      data.amount < 1
    ) {
      throw new BadRequestException('Thông tin lần tính phí không hợp lệ');
    }

    // Bảo đảm cả hai ví tồn tại trước khi bắt đầu transaction khóa số dư.
    await Promise.all([
      this.walletAccountService.findOrCreateWallet(data.learnerId),
      this.walletAccountService.findOrCreateWallet(data.mentorId),
    ]);

    return this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);
      const chargeRepo = manager.getRepository(SessionCharge);
      const ledgerRepo = manager.getRepository(CreditLedgerEntry);

      // Khóa theo thứ tự cố định để tránh deadlock khi nhiều learner trả cùng mentor.
      const wallets = await walletRepo
        .createQueryBuilder('wallet')
        .setLock('pessimistic_write')
        .where('wallet.userId IN (:...userIds)', {
          userIds: [data.learnerId, data.mentorId].sort(),
        })
        .orderBy('wallet.userId', 'ASC')
        .getMany();
      const learnerWallet = wallets.find(
        (wallet) => wallet.userId === data.learnerId,
      );
      const mentorWallet = wallets.find(
        (wallet) => wallet.userId === data.mentorId,
      );
      if (!learnerWallet || !mentorWallet) {
        throw new BadRequestException('Không tìm thấy ví người học hoặc mentor');
      }

      const existingCharge = await chargeRepo.findOne({
        where: { chargeKey: data.chargeKey },
      });
      if (existingCharge) {
        return {
          success: true,
          charged: false,
          alreadyProcessed: true,
          balanceAfter: learnerWallet.availableBalance,
        };
      }

      if (learnerWallet.availableBalance < data.amount) {
        return {
          success: false,
          charged: false,
          reason: 'INSUFFICIENT_BALANCE',
          balanceAfter: learnerWallet.availableBalance,
        };
      }

      learnerWallet.availableBalance -= data.amount;
      learnerWallet.totalSpent += data.amount;
      // Host không nhận trực tiếp vào availableBalance từng phút mà đưa vào quỹ tạm giữ (escrow)
      mentorWallet.escrowedBalance = Number(mentorWallet.escrowedBalance || 0) + data.amount;
      await walletRepo.save([learnerWallet, mentorWallet]);

      const debitEntry = await ledgerRepo.save(
        ledgerRepo.create({
          walletId: learnerWallet.id,
          userId: data.learnerId,
          direction: LedgerDirection.DEBIT,
          entryType: EntryType.HEARTBEAT_DEDUCT,
          amount: data.amount,
          balanceAfter: learnerWallet.availableBalance,
          referenceId: data.chargeKey,
          referenceKind: ReferenceKind.SESSION_ROOM,
        }),
      );

      // Ghi nhận phiên trừ tiền của học viên vào quỹ phòng nhóm
      await chargeRepo.save(
        chargeRepo.create({
          roomId: data.roomId,
          learnerId: data.learnerId,
          mentorId: data.mentorId,
          chargeKey: data.chargeKey,
          minuteIndex: data.minuteIndex,
          minutesCharged: data.amount,
          ledgerEntryId: debitEntry.id,
        }),
      );

      return {
        success: true,
        charged: true,
        alreadyProcessed: false,
        balanceAfter: learnerWallet.availableBalance,
      };
    });
  }

  /**
   * Hoàn Credit cho User (credit.refund)
   */
  async refundCredit(data: {
    userId: string;
    amount: number;
    reason: string;
    referenceId?: string;
  }) {
    const wallet = await this.walletAccountService.findOrCreateWallet(data.userId);
    wallet.availableBalance += data.amount;

    const savedWallet = await this.walletAccountService['walletRepo'].save(wallet);

    let entryType = EntryType.TRIAL_REFUND;
    if (data.reason?.includes('CANCELLATION')) entryType = EntryType.CANCELLATION_REFUND;
    if (data.reason?.includes('AFK')) entryType = EntryType.AFK_REFUND;

    await this.walletLedgerService.recordEntry({
      walletId: savedWallet.id,
      userId: data.userId,
      direction: LedgerDirection.CREDIT,
      entryType,
      amount: data.amount,
      balanceAfter: savedWallet.availableBalance,
      referenceId: data.referenceId,
      referenceKind: ReferenceKind.ADJUSTMENT,
    });

    return savedWallet;
  }
}
