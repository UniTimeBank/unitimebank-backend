import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { WalletTransactionService } from './wallet-transaction.service';
import { CreditRewardEventDto, CreditDeductEventDto, CreditRefundEventDto } from '@app/contracts/wallet';

@Controller()
export class WalletTransactionController {
  constructor(private readonly walletTransactionService: WalletTransactionService) {}

  @EventPattern('credit.reward')
  @MessagePattern('credit.reward')
  async handleCreditReward(@Payload() data: CreditRewardEventDto) {
    if (!data?.userId || !data?.amount) return;
    return this.walletTransactionService.rewardCredit(data);
  }

  @EventPattern('user.checkin_streak')
  @MessagePattern('user.checkin_streak')
  async handleUserCheckinStreak(@Payload() data: { userId: string; streakDays: number; rewardCredits: number }) {
    if (!data?.userId) return;
    return this.walletTransactionService.rewardCredit({
      userId: data.userId,
      rewardType: 'DAILY_CHECKIN',
      amount: data.rewardCredits || 1,
      sourceEvent: `streak_${data.streakDays}_days`,
    });
  }

  @EventPattern('credit.deduct')
  @MessagePattern('credit.deduct')
  async handleCreditDeduct(@Payload() data: CreditDeductEventDto) {
    if (!data?.learnerId || !data?.mentorId) return;
    return this.walletTransactionService.deductHeartbeat(data);
  }

  @EventPattern('credit.refund')
  @MessagePattern('credit.refund')
  async handleCreditRefund(@Payload() data: CreditRefundEventDto) {
    if (!data?.userId || !data?.amount) return;
    return this.walletTransactionService.refundCredit(data);
  }
}
