import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { WalletEscrowService } from './wallet-escrow.service';
import { BookingAcceptedEventDto, SessionEndedEventDto } from '@app/contracts/wallet';

@Controller()
export class WalletEscrowController {
  constructor(private readonly walletEscrowService: WalletEscrowService) {}

  @EventPattern('booking.accepted')
  @MessagePattern('booking.accepted')
  async handleBookingAccepted(@Payload() data: BookingAcceptedEventDto) {
    if (!data?.bookingId || !data?.learnerId) return;
    return this.walletEscrowService.holdEscrow(data);
  }

  @EventPattern('session.ended')
  @MessagePattern('session.ended')
  @EventPattern('booking.completed')
  @MessagePattern('booking.completed')
  async handleSessionEnded(@Payload() data: SessionEndedEventDto) {
    if (!data?.learnerId || !data?.mentorId) return;
    return this.walletEscrowService.releaseEscrow(data);
  }

  @EventPattern('wallet.refundEscrow')
  @MessagePattern('wallet.refundEscrow')
  async handleRefundEscrow(@Payload() data: { bookingId: string; learnerId: string; amount: number; reason?: string }) {
    if (!data?.bookingId || !data?.learnerId) return;
    return this.walletEscrowService.refundEscrow(data);
  }
}
