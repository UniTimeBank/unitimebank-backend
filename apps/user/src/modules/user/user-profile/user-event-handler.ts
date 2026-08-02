import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { UserProfileService } from './user-profile.service';
import { USER_EVENTS } from '@app/contracts/events';

@Controller()
export class UserEventHandler {
  constructor(private readonly userProfileService: UserProfileService) {
  }

  @EventPattern(USER_EVENTS.USER_REGISTERED)
  async handleUserRegistered(@Payload() data: { userId: string; email?: string }) {
    console.log(`[USER EVENT] Received USER_REGISTERED event for userId: ${data?.userId}`);

    if (!data?.userId) {
      console.error('[USER EVENT] Missing userId in event payload');
      return;
    }

    try {
      await this.userProfileService.createProfile(data.userId);
      console.log(`[USER EVENT] User profile successfully created for userId: ${data.userId}`);
    } catch (error) {
      console.error(`[USER EVENT] Error creating user profile:`, error);
    }
  }
}
