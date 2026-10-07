import { Controller, Get, Post, Patch, Param, Query, Body, Req, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';

@ApiTags('Notifications - Quản lý thông báo người dùng')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ==========================================
  // HTTP REST Endpoints (Internal / Direct)
  // ==========================================

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách thông báo của tôi' })
  async getMyNotifications(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationService.getMyNotifications(
      req.user.id,
      limit ? Number(limit) : 20,
      unreadOnly === 'true',
      page ? Number(page) : 1,
    );
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy số lượng thông báo chưa đọc' })
  async getUnreadCount(@Req() req: any) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng ký Device Push Token (FCM / Expo)' })
  async savePushToken(
    @Req() req: any,
    @Body() body: { token: string; platform?: string },
  ) {
    return this.notificationService.savePushToken(
      req.user.id,
      body.token,
      body.platform || 'android',
    );
  }

  @Post('test-push')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi thông báo đẩy thử nghiệm (Push test)' })
  async testPush(
    @Req() req: any,
    @Body() body: { title?: string; body?: string },
  ) {
    return this.notificationService.testPush(req.user.id, body?.title, body?.body);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo là đã đọc' })
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.markAsRead(req.user.id, id);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo là đã đọc' })
  async markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa một thông báo khỏi hộp thư' })
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.deleteNotification(req.user.id, id);
  }

  // ==========================================
  // RabbitMQ MessagePattern RPC Handlers
  // ==========================================

  @MessagePattern('notification.savePushToken')
  async handleSavePushToken(
    @Payload() data: { userId: string; token: string; platform?: string },
  ) {
    return this.notificationService.savePushToken(data.userId, data.token, data.platform);
  }

  @MessagePattern('notification.getMyNotifications')
  async handleGetMyNotifications(
    @Payload() data: { userId: string; page?: number; limit?: number; unreadOnly?: boolean },
  ) {
    return this.notificationService.getMyNotifications(
      data.userId,
      data.limit ? Number(data.limit) : 20,
      Boolean(data.unreadOnly),
      data.page ? Number(data.page) : 1,
    );
  }

  @MessagePattern('notification.getUnreadCount')
  async handleGetUnreadCount(@Payload() data: { userId: string }) {
    return this.notificationService.getUnreadCount(data.userId);
  }

  @MessagePattern('notification.markAsRead')
  async handleMarkAsRead(@Payload() data: { userId: string; id: string }) {
    return this.notificationService.markAsRead(data.userId, data.id);
  }

  @MessagePattern('notification.markAllAsRead')
  async handleMarkAllAsRead(@Payload() data: { userId: string }) {
    return this.notificationService.markAllAsRead(data.userId);
  }

  @MessagePattern('notification.delete')
  async handleDelete(@Payload() data: { userId: string; id: string }) {
    return this.notificationService.deleteNotification(data.userId, data.id);
  }

  @MessagePattern('notification.testPush')
  async handleTestPush(
    @Payload() data: { userId: string; title?: string; body?: string },
  ) {
    return this.notificationService.testPush(data.userId, data.title, data.body);
  }
}
