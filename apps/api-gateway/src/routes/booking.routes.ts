import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingClient } from '../clients/booking.client';
import {
  CreateMentorPostBookingDto,
  CreateLearnerRequestBookingDto,
  RejectBookingDto,
  GetBookingsQueryDto,
  GetBookingsResponseDto,
  BookingResponseDto,
} from '@app/contracts/booking';

@ApiTags('Booking - Đặt lịch & Quản lý đề nghị')
@Controller('bookings')
export class BookingRoutes {
  constructor(private readonly bookingClient: BookingClient) {}

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

  /** GET /bookings/:bookingId — Lấy chi tiết 1 Booking */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết 1 Booking' })
  @ApiResponse({ status: 200, description: 'Chi tiết booking', type: BookingResponseDto })
  async getBookingById(@Param('id') id: string, @Req() req: any) {
    return this.bookingClient.getBookingById(id, this.getAuthHeaders(req));
  }
}
