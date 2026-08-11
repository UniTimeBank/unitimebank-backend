import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscrowHold } from '../entities/escrow-hold.entity';
import { WalletAccountService } from '../wallet-account/wallet-account.service';
import { WalletLedgerService } from '../wallet-ledger/wallet-ledger.service';
import { LedgerDirection, EntryType, ReferenceKind, EscrowStatus, ReleaseReason } from '../enums';

@Injectable()
export class WalletEscrowService {
  constructor(
    @InjectRepository(EscrowHold)
    private readonly escrowRepo: Repository<EscrowHold>,
    private readonly walletAccountService: WalletAccountService,
    private readonly walletLedgerService: WalletLedgerService,
  ) {}

  /**
   * Ký quỹ credit khi booking được chấp nhận (booking.accepted)
   */
  async holdEscrow(data: { bookingId: string; learnerId: string; amount: number }): Promise<EscrowHold> {
    const wallet = await this.walletAccountService.findOrCreateWallet(data.learnerId);

    if (wallet.availableBalance < data.amount) {
      throw new BadRequestException('Số dư khả dụng không đủ để ký quỹ booking');
    }

    wallet.availableBalance -= data.amount;
    wallet.escrowedBalance += data.amount;
    wallet.totalSpent += data.amount;

    await this.walletAccountService.findOrCreateWallet(data.learnerId); // Save via repo in service
    const savedWallet = await this.walletAccountService['walletRepo'].save(wallet);

    const escrow = this.escrowRepo.create({
      walletId: savedWallet.id,
      userId: data.learnerId,
      bookingId: data.bookingId,
      amount: data.amount,
      status: EscrowStatus.HELD,
      heldAt: new Date(),
    });
    const savedEscrow = await this.escrowRepo.save(escrow);

    await this.walletLedgerService.recordEntry({
      walletId: savedWallet.id,
      userId: data.learnerId,
      direction: LedgerDirection.DEBIT,
      entryType: EntryType.ESCROW_HOLD,
      amount: data.amount,
      balanceAfter: savedWallet.availableBalance,
      referenceId: data.bookingId,
      referenceKind: ReferenceKind.BOOKING,
    });

    return savedEscrow;
  }

  /**
   * Giải phóng tiền ký quỹ cho Mentor khi kết thúc buổi học (session.ended)
   */
  async releaseEscrow(data: {
    roomId: string;
    bookingId?: string;
    learnerId: string;
    mentorId: string;
    creditsTransferred: number;
  }) {
    // 1. Cập nhật trạng thái EscrowHold nếu có bookingId
    if (data.bookingId) {
      const escrow = await this.escrowRepo.findOne({
        where: { bookingId: data.bookingId, status: EscrowStatus.HELD },
      });
      if (escrow) {
        escrow.status = EscrowStatus.RELEASED;
        escrow.releasedAt = new Date();
        escrow.releaseReason = ReleaseReason.SESSION_COMPLETED;
        await this.escrowRepo.save(escrow);
      }
    }

    // 2. Trừ escrowedBalance ở phía Learner
    const learnerWallet = await this.walletAccountService.findOrCreateWallet(data.learnerId);
    learnerWallet.escrowedBalance = Math.max(0, learnerWallet.escrowedBalance - data.creditsTransferred);
    await this.walletAccountService['walletRepo'].save(learnerWallet);

    // 3. Cộng availableBalance và totalEarned ở phía Mentor
    const mentorWallet = await this.walletAccountService.findOrCreateWallet(data.mentorId);
    mentorWallet.availableBalance += data.creditsTransferred;
    mentorWallet.totalEarned += data.creditsTransferred;
    const savedMentorWallet = await this.walletAccountService['walletRepo'].save(mentorWallet);

    // 4. Ghi sổ cái cho Mentor nhận credit
    await this.walletLedgerService.recordEntry({
      walletId: savedMentorWallet.id,
      userId: data.mentorId,
      direction: LedgerDirection.CREDIT,
      entryType: EntryType.ESCROW_RELEASE,
      amount: data.creditsTransferred,
      balanceAfter: savedMentorWallet.availableBalance,
      referenceId: data.roomId || data.bookingId,
      referenceKind: ReferenceKind.SESSION_ROOM,
    });

    return { success: true, creditsTransferred: data.creditsTransferred };
  }
}
