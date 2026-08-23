import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, Subject, map, filter } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { NotificationClient } from '../clients/notification.client';

export const notificationEventSubject = new Subject<{
  recipientId?: string;
  data: any;
}>();

@ApiTags('Notifications - Quản lý thông báo người dùng')
@Controller('notifications')
export class NotificationRoutes {
  constructor(private readonly notificationClient: NotificationClient) {}

  @Sse('stream')
  @ApiOperation({ summary: 'Server-Sent Events stream cho thông báo thời gian thực' })
  notificationStream(
    @Req() req: any,
    @Query('token') token?: string,
  ): Observable<MessageEvent> {
    const authHeader = req.headers?.authorization;
    let userId = req.user?.id || req.user?.sub;
    const authToken =
      token ||
      (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null);

    if (!userId && authToken) {
      try {
        const decoded: any = jwt.decode(authToken);
        userId = decoded?.sub || decoded?.id;
      } catch {}
    }

    return notificationEventSubject.asObservable().pipe(
      filter((event) => !event.recipientId || !userId || event.recipientId === userId),
      map(
        (event) =>
          ({
            data: JSON.stringify(event.data || { type: 'NOTIFICATION_UPDATE' }),
          } as MessageEvent),
      ),
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách thông báo của người dùng đăng nhập' })
  getMyNotifications(
    @Req() req: any,
    @Query('limit') limit?: number,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationClient.getMyNotifications(req.user.id, {
      limit: limit ? Number(limit) : 20,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy số lượng thông báo chưa đọc' })
  getUnreadCount(@Req() req: any) {
    return this.notificationClient.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo là đã đọc' })
  markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationClient.markAsRead(req.user.id, id);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo là đã đọc' })
  markAllAsRead(@Req() req: any) {
    return this.notificationClient.markAllAsRead(req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa một thông báo' })
  deleteNotification(@Req() req: any, @Param('id') id: string) {
    return this.notificationClient.deleteNotification(req.user.id, id);
  }
}
