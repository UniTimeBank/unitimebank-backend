import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { WalletEscrowService } from './wallet-escrow.service';
import { BookingAcceptedEventDto } from '@app/contracts/wallet';

@Controller()
export class WalletEscrowController {
  private readonly logger = new Logger(WalletEscrowController.name);

  constructor(private readonly walletEscrowService: WalletEscrowService) {}

  @EventPattern('booking.accepted')
  async handleBookingAcceptedEvent(@Payload() data: BookingAcceptedEventDto) {
    this.logger.log(`[Event booking.accepted] Received: ${JSON.stringify(data)}`);
    if (!data?.bookingId || !data?.learnerId) return;
    return this.walletEscrowService.holdEscrow(data);
  }

  @MessagePattern('booking.accepted')
  async handleBookingAcceptedMessage(@Payload() data: BookingAcceptedEventDto) {
    this.logger.log(`[Message booking.accepted] Received: ${JSON.stringify(data)}`);
    if (!data?.bookingId || !data?.learnerId) return;
    return this.walletEscrowService.holdEscrow(data);
  }

  // ════════════════════════════════════════════════════════════════
  // 1. RELEASE ESCROW: wallet.releaseEscrow (Event + Message)
  // ════════════════════════════════════════════════════════════════
  @EventPattern('wallet.releaseEscrow')
  async handleReleaseEscrowEvent(@Payload() data: any) {
    this.logger.log(`[Event wallet.releaseEscrow] Received: ${JSON.stringify(data)}`);
    if (!data) return;
    return this.walletEscrowService.releaseEscrow(data);
  }

  @MessagePattern('wallet.releaseEscrow')
  async handleReleaseEscrowMessage(@Payload() data: any) {
    this.logger.log(`[Message wallet.releaseEscrow] Received: ${JSON.stringify(data)}`);
    if (!data) return;
    return this.walletEscrowService.releaseEscrow(data);
  }

  // ════════════════════════════════════════════════════════════════
  // 2. RELEASE ESCROW: session.ended (Event + Message)
  // ════════════════════════════════════════════════════════════════
  @EventPattern('session.ended')
  async handleSessionEndedEvent(@Payload() data: any) {
    this.logger.log(`[Event session.ended] Received: ${JSON.stringify(data)}`);
    if (!data) return;
    return this.walletEscrowService.releaseEscrow(data);
  }

  @MessagePattern('session.ended')
  async handleSessionEndedMessage(@Payload() data: any) {
    this.logger.log(`[Message session.ended] Received: ${JSON.stringify(data)}`);
    if (!data) return;
    return this.walletEscrowService.releaseEscrow(data);
  }

  // ════════════════════════════════════════════════════════════════
  // 3. RELEASE ESCROW: booking.completed (Event + Message)
  // ════════════════════════════════════════════════════════════════
  @EventPattern('booking.completed')
  async handleBookingCompletedEvent(@Payload() data: any) {
    this.logger.log(`[Event booking.completed] Received: ${JSON.stringify(data)}`);
    if (!data) return;
    return this.walletEscrowService.releaseEscrow(data);
  }

  @MessagePattern('booking.completed')
  async handleBookingCompletedMessage(@Payload() data: any) {
    this.logger.log(`[Message booking.completed] Received: ${JSON.stringify(data)}`);
    if (!data) return;
    return this.walletEscrowService.releaseEscrow(data);
  }

  // ════════════════════════════════════════════════════════════════
  // 4. REFUND ESCROW: wallet.refundEscrow (Event + Message)
  // ════════════════════════════════════════════════════════════════
  @EventPattern('wallet.refundEscrow')
  async handleRefundEscrowEvent(@Payload() data: { bookingId: string; learnerId: string; amount: number; reason?: string }) {
    this.logger.log(`[Event wallet.refundEscrow] Received: ${JSON.stringify(data)}`);
    if (!data?.bookingId || !data?.learnerId) return;
    return this.walletEscrowService.refundEscrow(data);
  }

  @MessagePattern('wallet.refundEscrow')
  async handleRefundEscrowMessage(@Payload() data: { bookingId: string; learnerId: string; amount: number; reason?: string }) {
    this.logger.log(`[Message wallet.refundEscrow] Received: ${JSON.stringify(data)}`);
    if (!data?.bookingId || !data?.learnerId) return;
    return this.walletEscrowService.refundEscrow(data);
  }

  // ════════════════════════════════════════════════════════════════
  // 5. RELEASE GROUP ESCROW: wallet.releaseGroupEscrow (Event + Message)
  // ════════════════════════════════════════════════════════════════
  @EventPattern('wallet.releaseGroupEscrow')
  async handleReleaseGroupEscrowEvent(@Payload() data: { roomId: string; mentorId: string; amount: number }) {
    this.logger.log(`[Event wallet.releaseGroupEscrow] Received: ${JSON.stringify(data)}`);
    if (!data?.roomId || !data?.mentorId) return;
    return this.walletEscrowService.releaseGroupEscrow(data);
  }

  @MessagePattern('wallet.releaseGroupEscrow')
  async handleReleaseGroupEscrowMessage(@Payload() data: { roomId: string; mentorId: string; amount: number }) {
    this.logger.log(`[Message wallet.releaseGroupEscrow] Received: ${JSON.stringify(data)}`);
    if (!data?.roomId || !data?.mentorId) return;
    return this.walletEscrowService.releaseGroupEscrow(data);
  }
}
