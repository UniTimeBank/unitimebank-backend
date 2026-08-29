import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { UserProfileService } from './user-profile.service';
import { USER_EVENTS, MODERATION_EVENTS } from '@app/contracts/events';

@Controller()
export class UserEventHandler {
  constructor(private readonly userProfileService: UserProfileService) {}

  @EventPattern(USER_EVENTS.USER_REGISTERED)
  async handleUserRegistered(@Payload() data: { userId: string; email?: string; displayName?: string; avatarUrl?: string }) {
    console.log(`[USER EVENT] Received USER_REGISTERED event for userId: ${data?.userId}, displayName: ${data?.displayName}`);

    if (!data?.userId) {
      console.error('[USER EVENT] Missing userId in event payload');
      return;
    }

    try {
      await this.userProfileService.createProfile(data.userId, {
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
      });
      console.log(`[USER EVENT] User profile successfully created for userId: ${data.userId}`);
    } catch (error) {
      console.error(`[USER EVENT] Error creating user profile:`, error);
    }
  }

  @EventPattern(MODERATION_EVENTS.TRUST_SCORE_UPDATED)
  async handleTrustScoreUpdated(@Payload() data: { userId: string; score: number }) {
    if (!data?.userId) return;
    try {
      await this.userProfileService.updateTrustScore(data.userId, data.score);
    } catch (error) {
      console.error('[USER EVENT] Error updating trust score:', error);
    }
  }
}
