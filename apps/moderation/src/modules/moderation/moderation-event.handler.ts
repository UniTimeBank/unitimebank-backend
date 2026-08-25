import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ModerationService } from './moderation.service';
import { USER_EVENTS, UserRegisteredEvent } from '@app/contracts';
import { TrustChangeReason } from './enums';

@Controller()
export class ModerationEventHandler {
  private readonly logger = new Logger(ModerationEventHandler.name);

  constructor(private readonly moderationService: ModerationService) {}

  @EventPattern(USER_EVENTS.USER_REGISTERED)
  async handleUserRegistered(@Payload() event: any) {
    this.logger.log(`Handling user.registered for user: ${event.userId}`);
    await this.moderationService.getOrCreateTrustScore(event.userId);
  }


  @EventPattern('booking.no_show')
  async handleBookingNoShow(@Payload() event: { bookingId: string; userId: string; reason?: string }) {
    this.logger.log(`Handling booking.no_show for user: ${event.userId}`);
    await this.moderationService.changeTrustScore(
      event.userId,
      -15,
      TrustChangeReason.NO_SHOW,
      event.bookingId,
      'BOOKING_NO_SHOW',
    );
  }

  @EventPattern('booking.late_cancelled_by_mentor')
  async handleMentorLateCancel(@Payload() event: { bookingId: string; mentorId: string }) {
    this.logger.log(`Handling booking.late_cancelled_by_mentor for mentor: ${event.mentorId}`);
    await this.moderationService.changeTrustScore(
      event.mentorId,
      -10,
      TrustChangeReason.LAST_MINUTE_CANCEL,
      event.bookingId,
      'BOOKING_LATE_CANCEL',
    );
  }
}
