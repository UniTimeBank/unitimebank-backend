import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { NotificationClient } from '../clients/notification.client';

@Controller('notifications')
export class NotificationRoutes {
  constructor(private readonly notificationClient: NotificationClient) {}

  @Get(':userId')
  findAll(@Param('userId') userId: string) {
    return this.notificationClient.send('notification.findAll', { userId });
  }

  @Put(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationClient.send('notification.markAsRead', { id });
  }

  @Put(':userId/read-all')
  markAllAsRead(@Param('userId') userId: string) {
    return this.notificationClient.send('notification.markAllAsRead', { userId });
  }
}
