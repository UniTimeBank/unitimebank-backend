import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';

@ApiTags('Notifications - Quản lý thông báo người dùng')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách thông báo của tôi' })
  async getMyNotifications(@Req() req: any, @Query('limit') limit?: number) {
    return this.notificationService.getMyNotifications(req.user.id, limit ? Number(limit) : 20);
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
    await this.notificationService.markAllAsRead(req.user.id);
    return { success: true, message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }
}
