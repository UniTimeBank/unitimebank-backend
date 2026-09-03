import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscrowHold } from '../entities/escrow-hold.entity';
import { WalletAccountService } from '../wallet-account/wallet-account.service';
import { WalletLedgerService } from '../wallet-ledger/wallet-ledger.service';
import { LedgerDirection, EntryType, ReferenceKind, EscrowStatus, ReleaseReason } from '../enums';

@Injectable()
export class WalletEscrowService {
  private readonly logger = new Logger(WalletEscrowService.name);

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
   * Giải phóng tiền ký quỹ cho Mentor khi kết thúc buổi học (session.ended / booking.completed / wallet.releaseEscrow)
   */
  async releaseEscrow(data: {
    roomId?: string;
    bookingId?: string;
    learnerId?: string;
    mentorId?: string;
    creditsTransferred?: number;
  }) {
    this.logger.log(`[releaseEscrow] Starting with data: ${JSON.stringify(data)}`);
    let transferAmount = Number(data.creditsTransferred) || 0;
    let learnerId = data.learnerId;

    // 1. Cập nhật trạng thái EscrowHold nếu có bookingId
    if (data.bookingId) {
      const escrow = await this.escrowRepo.findOne({
        where: { bookingId: data.bookingId },
      });
      if (escrow) {
        if (!transferAmount || transferAmount <= 0) {
          transferAmount = Number(escrow.amount);
        }
        if (!learnerId) {
          learnerId = escrow.userId;
        }
        if (escrow.status === EscrowStatus.HELD) {
          escrow.status = EscrowStatus.RELEASED;
          escrow.releasedAt = new Date();
          escrow.releaseReason = ReleaseReason.SESSION_COMPLETED;
          await this.escrowRepo.save(escrow);
        }
      }
    }

    if (!data.mentorId) {
      this.logger.error(`[releaseEscrow] Missing mentorId for booking ${data.bookingId}`);
      return { success: false, message: 'Thiếu mentorId' };
    }

    if (!transferAmount || transferAmount <= 0) {
      this.logger.warn(`[releaseEscrow] No escrow amount to release for booking ${data.bookingId}`);
      return { success: false, message: 'Không có số dư ký quỹ cần giải ngân' };
    }

    // 2. Trừ escrowedBalance ở phía Learner (nếu có learnerId)
    if (learnerId) {
      const learnerWallet = await this.walletAccountService.findOrCreateWallet(learnerId);
      learnerWallet.escrowedBalance = Math.max(0, Number(learnerWallet.escrowedBalance) - transferAmount);
      await this.walletAccountService['walletRepo'].save(learnerWallet);
      this.logger.log(`[releaseEscrow] Deducted ${transferAmount} escrowed balance from learner ${learnerId}`);
    }

    // 3. Cộng availableBalance và totalEarned ở phía Mentor
    const mentorWallet = await this.walletAccountService.findOrCreateWallet(data.mentorId);
    mentorWallet.availableBalance = Number(mentorWallet.availableBalance) + transferAmount;
    mentorWallet.totalEarned = Number(mentorWallet.totalEarned) + transferAmount;
    const savedMentorWallet = await this.walletAccountService['walletRepo'].save(mentorWallet);

    // 4. Ghi sổ cái cho Mentor nhận credit
    await this.walletLedgerService.recordEntry({
      walletId: savedMentorWallet.id,
      userId: data.mentorId,
      direction: LedgerDirection.CREDIT,
      entryType: EntryType.ESCROW_RELEASE,
      amount: transferAmount,
      balanceAfter: savedMentorWallet.availableBalance,
      referenceId: data.bookingId || data.roomId,
      referenceKind: data.bookingId ? ReferenceKind.BOOKING : ReferenceKind.SESSION_ROOM,
    });

    this.logger.log(
      `[releaseEscrow] Successfully released ${transferAmount} credits to mentor ${data.mentorId}. New availableBalance: ${savedMentorWallet.availableBalance}`,
    );

    return { success: true, creditsTransferred: transferAmount };
  }

  /**
   * Giải phóng tiền ký quỹ phòng nhóm cho Mentor khi đóng phòng (closeGroupRoom)
   */
  async releaseGroupEscrow(data: {
    roomId: string;
    mentorId: string;
    amount: number;
  }) {
    this.logger.log(`[releaseGroupEscrow] Starting for room ${data.roomId}, mentor ${data.mentorId}, amount: ${data.amount}`);
    const transferAmount = Number(data.amount) || 0;
    if (transferAmount <= 0) {
      this.logger.log(`[releaseGroupEscrow] Room ${data.roomId} had 0 credits to release`);
      return { success: true, creditsTransferred: 0 };
    }

    if (!data.mentorId) {
      this.logger.error(`[releaseGroupEscrow] Missing mentorId for room ${data.roomId}`);
      return { success: false, message: 'Thiếu mentorId' };
    }

    // 1. Trừ escrowedBalance và cộng availableBalance, totalEarned cho Mentor
    const mentorWallet = await this.walletAccountService.findOrCreateWallet(data.mentorId);
    mentorWallet.escrowedBalance = Math.max(0, Number(mentorWallet.escrowedBalance || 0) - transferAmount);
    mentorWallet.availableBalance = Number(mentorWallet.availableBalance) + transferAmount;
    mentorWallet.totalEarned = Number(mentorWallet.totalEarned) + transferAmount;
    const savedMentorWallet = await this.walletAccountService['walletRepo'].save(mentorWallet);

    // 2. Ghi đúng 1 bản ghi sổ cái duy nhất cho Mentor khi phòng đóng thành công
    await this.walletLedgerService.recordEntry({
      walletId: savedMentorWallet.id,
      userId: data.mentorId,
      direction: LedgerDirection.CREDIT,
      entryType: EntryType.ESCROW_RELEASE,
      amount: transferAmount,
      balanceAfter: savedMentorWallet.availableBalance,
      referenceId: data.roomId,
      referenceKind: ReferenceKind.SESSION_ROOM,
    });

    this.logger.log(
      `[releaseGroupEscrow] Successfully released ${transferAmount} credits to mentor ${data.mentorId} for room ${data.roomId}. New availableBalance: ${savedMentorWallet.availableBalance}`,
    );

    return { success: true, creditsTransferred: transferAmount };
  }

  /**
   * Hoàn trả tiền ký quỹ cho Learner khi hủy booking (wallet.refundEscrow)
   */
  async refundEscrow(data: {
    bookingId: string;
    learnerId: string;
    amount: number;
    feeAmount?: number;
    mentorId?: string;
    reason?: string;
  }) {
    const fee = data.feeAmount || 0;
    const refundAmount = data.amount;
    const totalDeduct = refundAmount + fee;

    // 1. Cập nhật bản ghi EscrowHold
    if (data.bookingId) {
      const escrow = await this.escrowRepo.findOne({
        where: { bookingId: data.bookingId, status: EscrowStatus.HELD },
      });
      if (escrow) {
        escrow.status = EscrowStatus.REFUNDED;
        escrow.releasedAt = new Date();
        escrow.releaseReason = ReleaseReason.BOOKING_CANCELLED;
        await this.escrowRepo.save(escrow);
      }
    }

    // 2. Hoàn trả escrowedBalance về availableBalance cho Learner
    const learnerWallet = await this.walletAccountService.findOrCreateWallet(data.learnerId);
    learnerWallet.escrowedBalance = Math.max(0, learnerWallet.escrowedBalance - totalDeduct);
    learnerWallet.availableBalance += refundAmount;
    learnerWallet.totalSpent = Math.max(0, learnerWallet.totalSpent - refundAmount);
    const savedLearnerWallet = await this.walletAccountService['walletRepo'].save(learnerWallet);

    // 3. Ghi sổ cái hoàn tiền ký quỹ
    await this.walletLedgerService.recordEntry({
      walletId: savedLearnerWallet.id,
      userId: data.learnerId,
      direction: LedgerDirection.CREDIT,
      entryType: EntryType.CANCELLATION_REFUND,
      amount: refundAmount,
      balanceAfter: savedLearnerWallet.availableBalance,
      referenceId: data.bookingId,
      referenceKind: ReferenceKind.BOOKING,
    });

    // 4. Nếu có phí hủy đền bù cho Mentor
    if (fee > 0 && data.mentorId) {
      const mentorWallet = await this.walletAccountService.findOrCreateWallet(data.mentorId);
      mentorWallet.availableBalance += fee;
      mentorWallet.totalEarned += fee;
      const savedMentor = await this.walletAccountService['walletRepo'].save(mentorWallet);

      await this.walletLedgerService.recordEntry({
        walletId: savedMentor.id,
        userId: data.mentorId,
        direction: LedgerDirection.CREDIT,
        entryType: EntryType.ESCROW_RELEASE,
        amount: fee,
        balanceAfter: savedMentor.availableBalance,
        referenceId: data.bookingId,
        referenceKind: ReferenceKind.BOOKING,
      });
    }

    return { success: true, refundedAmount: refundAmount, fee };
  }
}
