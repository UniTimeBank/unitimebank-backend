import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Sse,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable, Subject, map, filter } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { BookingClient } from '../clients/booking.client';
import { notificationEventSubject } from './notification.routes';

// Global Event Stream Subject for realtime SSE events (Typing, Messages)
const bookingEventSubject = new Subject<{ bookingId: string; senderId?: string; data: any }>();


import {
  CreateMentorPostBookingDto,
  CreateLearnerRequestBookingDto,
  RejectBookingDto,
  GetBookingsQueryDto,
  GetBookingsResponseDto,
  BookingResponseDto,
  SendBookingMessageDto,
  BookingMessageResponseDto,
} from '@app/contracts/booking';

import { NotificationGateway } from '../gateways/notification.gateway';

@ApiTags('Booking - Đặt lịch & Quản lý đề nghị')
@Controller('bookings')
export class BookingRoutes {
  constructor(
    private readonly bookingClient: BookingClient,
    private readonly notificationGateway: NotificationGateway,
  ) {}


  private getAuthHeaders(req: any): Record<string, string> {
    return req.headers.authorization ? { Authorization: req.headers.authorization } : {};
  }

  // ════════════════════════════════════════════════════════════════
  // TẠO YÊU CẦU BOOKING
  // ════════════════════════════════════════════════════════════════

  /** POST /bookings — Learner tạo yêu cầu đặt lịch 1:1 */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Learner tạo yêu cầu đặt lịch 1:1 (theo API doc POST /bookings)' })
  @ApiBody({ type: CreateMentorPostBookingDto })
  @ApiResponse({ status: 201, description: 'Gửi yêu cầu đặt lịch thành công', type: BookingResponseDto })
  async createBooking(@Body() dto: CreateMentorPostBookingDto, @Req() req: any) {
    return this.bookingClient.createBooking(dto, this.getAuthHeaders(req));
  }

  /** POST /bookings/request-mentor-post — Alias */
  @Post('request-mentor-post')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Learner gửi yêu cầu đặt lịch trên bài đăng của Mentor' })
  @ApiBody({ type: CreateMentorPostBookingDto })
  @ApiResponse({ status: 201, description: 'Gửi yêu cầu đặt lịch thành công', type: BookingResponseDto })
  async requestMentorPost(@Body() dto: CreateMentorPostBookingDto, @Req() req: any) {
    return this.bookingClient.createBooking(dto, this.getAuthHeaders(req));
  }

  /** POST /bookings/apply-learner-request — Mentor gửi đề nghị dạy */
  @Post('apply-learner-request')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor gửi đề nghị dạy trên Yêu cầu học của Learner' })
  @ApiBody({ type: CreateLearnerRequestBookingDto })
  @ApiResponse({ status: 201, description: 'Gửi đề nghị dạy thành công', type: BookingResponseDto })
  async applyLearnerRequest(@Body() dto: CreateLearnerRequestBookingDto, @Req() req: any) {
    return this.bookingClient.applyLearnerRequest(dto, this.getAuthHeaders(req));
  }

  // ════════════════════════════════════════════════════════════════
  // XỬ LÝ TRẠNG THÁI BOOKING
  // ════════════════════════════════════════════════════════════════

  /** POST /bookings/:bookingId/accept — Chấp nhận booking (+ Ký quỹ Credit) */
  @Post(':id/accept')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận booking (Mentor duyệt / Learner chấp nhận đề nghị) + Ký quỹ Credit' })
  @ApiResponse({ status: 200, description: 'Chấp nhận và ký quỹ thành công', type: BookingResponseDto })
  async acceptBooking(@Param('id') id: string, @Req() req: any) {
    return this.bookingClient.acceptBooking(id, this.getAuthHeaders(req));
  }

  /** POST /bookings/:bookingId/complete — Hoàn thành buổi học & Giải phóng Credit ký quỹ */
  @Post(':id/complete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hoàn thành buổi học (Chuyển Credit ký quỹ sang số dư khả dụng của Mentor)' })
  @ApiResponse({ status: 200, description: 'Hoàn thành buổi học và giải phóng Credit thành công', type: BookingResponseDto })
  async completeBooking(@Param('id') id: string, @Req() req: any) {
    return this.bookingClient.completeBooking(id, this.getAuthHeaders(req));
  }

  /** POST /bookings/:bookingId/reject — Từ chối booking */
  @Post(':id/reject')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Từ chối booking' })
  @ApiBody({ type: RejectBookingDto })
  @ApiResponse({ status: 200, description: 'Đã từ chối booking', type: BookingResponseDto })
  async rejectBooking(@Param('id') id: string, @Body() body: RejectBookingDto, @Req() req: any) {
    return this.bookingClient.rejectBooking(id, body, this.getAuthHeaders(req));
  }

  /** POST /bookings/:bookingId/cancel — Hủy booking */
  @Post(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy booking (hoàn credit nếu đã ký quỹ, phạt Trust Score nếu hủy sát giờ)' })
  @ApiBody({ type: RejectBookingDto })
  @ApiResponse({ status: 200, description: 'Đã hủy booking' })
  async cancelBooking(@Param('id') id: string, @Body() body: RejectBookingDto, @Req() req: any) {
    return this.bookingClient.cancelBooking(id, body, this.getAuthHeaders(req));
  }

  /** POST /bookings/:bookingId/no-show — Đánh dấu không đến */
  @Post(':id/no-show')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu đối tác không đến (No-show), phạt Trust Score -15' })
  @ApiResponse({ status: 200, description: 'Đã đánh dấu no-show' })
  async markNoShow(@Param('id') id: string, @Req() req: any) {
    return this.bookingClient.markNoShow(id, this.getAuthHeaders(req));
  }

  // ════════════════════════════════════════════════════════════════
  // TRUY VẤN BOOKING
  // ════════════════════════════════════════════════════════════════

  /** GET /bookings — Lấy danh sách Booking của chính tôi */
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách Booking cá nhân (Learner hoặc Mentor)' })
  @ApiQuery({ name: 'role', required: false, enum: ['AS_LEARNER', 'AS_MENTOR', 'ALL'] })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Danh sách booking', type: GetBookingsResponseDto })
  async getMyBookings(@Query() query: GetBookingsQueryDto, @Req() req: any) {
    const params = new URLSearchParams();
    if (query.role) params.append('role', query.role);
    if (query.status) params.append('status', query.status);
    return this.bookingClient.getMyBookings(params.toString(), this.getAuthHeaders(req));
  }

  /** GET /bookings/mentor/:mentorId/busy-slots — Lấy danh sách các khung giờ đã có lịch của Mentor */
  @Get('mentor/:mentorId/busy-slots')
  @ApiOperation({ summary: 'Lấy danh sách các khung giờ đã có lịch (CONFIRMED / STARTED) của Mentor' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getMentorBusySlots(
    @Param('mentorId') mentorId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: any,
  ) {
    return this.bookingClient.getMentorBusySlots(mentorId, from, to, this.getAuthHeaders(req));
  }

  /** GET /bookings/:bookingId — Lấy chi tiết 1 Booking */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết 1 Booking' })
  @ApiResponse({ status: 200, description: 'Chi tiết booking', type: BookingResponseDto })
  async getBookingById(@Param('id') id: string, @Req() req: any) {
    return this.bookingClient.getBookingById(id, this.getAuthHeaders(req));
  }

  // ════════════════════════════════════════════════════════════════
  // TIN NHẮN TRAO ĐỔI TRƯỚC BUỔI HỌC (MESSAGING)
  // ════════════════════════════════════════════════════════════════

  /** GET /bookings/:bookingId/messages — Lấy danh sách tin nhắn */
  @Get(':id/messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách tin nhắn của buổi học' })
  @ApiResponse({ status: 200, description: 'Danh sách tin nhắn', type: [BookingMessageResponseDto] })
  async getBookingMessages(@Param('id') id: string, @Req() req: any) {
    return this.bookingClient.getBookingMessages(id, this.getAuthHeaders(req));
  }

  /** POST /bookings/:bookingId/messages — Gửi tin nhắn */
  @Post(':id/messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi tin nhắn trao đổi trong buổi học' })
  @ApiBody({ type: SendBookingMessageDto })
  @ApiResponse({ status: 201, description: 'Gửi tin nhắn thành công', type: BookingMessageResponseDto })
  /** POST /bookings/:bookingId/messages — Gửi tin nhắn */
  @Post(':id/messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi tin nhắn trao đổi trong buổi học' })
  @ApiBody({ type: SendBookingMessageDto })
  @ApiResponse({ status: 201, description: 'Gửi tin nhắn thành công', type: BookingMessageResponseDto })
  async sendBookingMessage(
    @Param('id') id: string,
    @Body() body: SendBookingMessageDto,
    @Req() req: any,
  ) {
    const result = await this.bookingClient.sendBookingMessage(id, body, this.getAuthHeaders(req));
    const userId = req.user?.id || req.user?.sub;

    // Broadcast SSE realtime events (Chat + Notification)
    bookingEventSubject.next({
      bookingId: id,
      senderId: userId,
      data: {
        type: 'new_message',
        bookingId: id,
        message: result,
      },
    });

    notificationEventSubject.next({
      data: {
        type: 'NOTIFICATION_UPDATE',
        bookingId: id,
        senderId: userId,
      },
    });

    // Broadcast realtime WebSocket / Socket.IO Notification
    this.notificationGateway.broadcastNotificationUpdate({
      type: 'NOTIFICATION_UPDATE',
      bookingId: id,
      senderId: userId,
    });

    return result;
  }

  /** POST /bookings/:id/typing — Báo hiệu trạng thái đang soạn tin */
  @Post(':id/typing')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật trạng thái đang soạn tin nhắn' })
  async setTypingStatus(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const authHeader = req.headers.authorization;
    let userId: string | undefined = req.user?.id || req.user?.sub;
    if (!userId && authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      try {
        const decoded: any = jwt.decode(authHeader.substring(7));
        userId = decoded?.sub || decoded?.id;
      } catch {}
    }

    const typing = typeof body === 'object' ? Boolean(body?.typing) : Boolean(body);
    const clientId = typeof body === 'object' ? body?.clientId : undefined;

    // Broadcast SSE realtime event (0ms latency!)
    bookingEventSubject.next({
      bookingId: id,
      senderId: userId,
      data: {
        type: 'typing',
        bookingId: id,
        userId,
        clientId,
        typing,
      },
    });

    return this.bookingClient.setTypingStatus(id, typing, this.getAuthHeaders(req));
  }

  /** POST /bookings/:id/attachments — Tải lên tệp đính kèm hoặc hình ảnh trong phòng chat */
  @Post(':id/attachments')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải lên hình ảnh hoặc tệp tin đính kèm trong tin nhắn' })
  async uploadChatAttachment(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    return this.bookingClient.uploadChatAttachment(id, file, this.getAuthHeaders(req));
  }

  /** GET /bookings/:id/events — Server-Sent Events stream cho RTK Query onCacheEntryAdded */
  @Sse(':id/events')
  @ApiOperation({ summary: 'Server-Sent Events stream cho tin nhắn và trạng thái gõ thời gian thực' })
  bookingEvents(@Param('id') id: string): Observable<MessageEvent> {
    return bookingEventSubject.asObservable().pipe(
      filter((event) => event.bookingId === id),
      map(
        (event) =>
          ({
            data: JSON.stringify(event.data),
          } as MessageEvent),
      ),
    );
  }
}



