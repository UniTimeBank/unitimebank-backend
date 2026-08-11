import { Injectable } from '@nestjs/common';
import { WalletAccountService } from '../wallet-account/wallet-account.service';
import { WalletLedgerService } from '../wallet-ledger/wallet-ledger.service';
import { LedgerDirection, EntryType, ReferenceKind } from '../enums';

@Injectable()
export class WalletTransactionService {
  constructor(
    private readonly walletAccountService: WalletAccountService,
    private readonly walletLedgerService: WalletLedgerService,
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
  }) {
    // 1. Trừ credit phía Learner
    const learnerWallet = await this.walletAccountService.findOrCreateWallet(data.learnerId);
    learnerWallet.availableBalance = Math.max(0, learnerWallet.availableBalance - data.amount);
    learnerWallet.totalSpent += data.amount;
    const savedLearner = await this.walletAccountService['walletRepo'].save(learnerWallet);

    await this.walletLedgerService.recordEntry({
      walletId: savedLearner.id,
      userId: data.learnerId,
      direction: LedgerDirection.DEBIT,
      entryType: EntryType.HEARTBEAT_DEDUCT,
      amount: data.amount,
      balanceAfter: savedLearner.availableBalance,
      referenceId: data.roomId,
      referenceKind: ReferenceKind.SESSION_ROOM,
    });

    // 2. Cộng credit phía Mentor
    const mentorWallet = await this.walletAccountService.findOrCreateWallet(data.mentorId);
    mentorWallet.availableBalance += data.amount;
    mentorWallet.totalEarned += data.amount;
    const savedMentor = await this.walletAccountService['walletRepo'].save(mentorWallet);

    await this.walletLedgerService.recordEntry({
      walletId: savedMentor.id,
      userId: data.mentorId,
      direction: LedgerDirection.CREDIT,
      entryType: EntryType.HEARTBEAT_DEDUCT,
      amount: data.amount,
      balanceAfter: savedMentor.availableBalance,
      referenceId: data.roomId,
      referenceKind: ReferenceKind.SESSION_ROOM,
    });

    return { success: true, learnerBalance: savedLearner.availableBalance };
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
