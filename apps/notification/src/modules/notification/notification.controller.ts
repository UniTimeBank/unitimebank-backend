import { Controller, Get, Patch, Param, Query, Req, UseGuards, Delete } from '@nestjs/common';
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
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationService.getMyNotifications(
      req.user.id,
      limit ? Number(limit) : 20,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy số lượng thông báo chưa đọc' })
  async getUnreadCount(@Req() req: any) {
    return this.notificationService.getUnreadCount(req.user.id);
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

  @MessagePattern('notification.getMyNotifications')
  async handleGetMyNotifications(
    @Payload() data: { userId: string; limit?: number; unreadOnly?: boolean },
  ) {
    return this.notificationService.getMyNotifications(
      data.userId,
      data.limit ? Number(data.limit) : 20,
      Boolean(data.unreadOnly),
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
}
