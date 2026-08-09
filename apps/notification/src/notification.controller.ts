import { Controller, Get, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { POST_EVENTS } from '@app/contracts/events';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getHello(): string {
    return this.notificationService.getHello();
  }

  @EventPattern(POST_EVENTS.POST_CREATED)
  handlePostCreated(@Payload() data: any) {
    this.logger.log(
      `Received ${POST_EVENTS.POST_CREATED} event for post ID: ${data.postId} ("${data.title}") by mentor ${data.mentorName}`
    );
  }
}
