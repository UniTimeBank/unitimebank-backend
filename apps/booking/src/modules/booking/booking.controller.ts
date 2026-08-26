import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { BookingService } from './booking.service';
import {
  CreateMentorPostBookingDto,
  CreateLearnerRequestBookingDto,
  RespondBookingDto,
  RejectBookingDto,
  GetBookingsQueryDto,
  GetBookingsResponseDto,
  BookingResponseDto,
  SendBookingMessageDto,
  BookingMessageResponseDto,
} from '@app/contracts/booking';

@ApiTags('Booking - Đặt lịch & Quản lý đề nghị')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // ════════════════════════════════════════════════════════════════
  // TẠO YÊU CẦU BOOKING
  // ════════════════════════════════════════════════════════════════

  /** POST /bookings — Learner tạo yêu cầu đặt lịch 1:1 */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Learner tạo yêu cầu đặt lịch 1:1 (mentorPostId)' })
  @ApiBody({ type: CreateMentorPostBookingDto })
  @ApiResponse({ status: 201, description: 'Gửi yêu cầu đặt lịch thành công', type: BookingResponseDto })
  async createBooking(@Body() dto: CreateMentorPostBookingDto, @Req() req: any) {
    const learnerId = req.user.id;
    return this.bookingService.requestMentorPost(learnerId, dto);
  }

  /** POST /bookings/apply-learner-request — Mentor gửi đề nghị dạy */
  @Post('apply-learner-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor gửi đề nghị dạy trên Yêu cầu học của Learner' })
  @ApiBody({ type: CreateLearnerRequestBookingDto })
  @ApiResponse({ status: 201, description: 'Gửi đề nghị dạy thành công', type: BookingResponseDto })
  async applyLearnerRequest(@Body() dto: CreateLearnerRequestBookingDto, @Req() req: any) {
    const mentorId = req.user.id;
    return this.bookingService.applyLearnerRequest(mentorId, dto);
  }

  // ════════════════════════════════════════════════════════════════
  // XỬ LÝ TRẠNG THÁI BOOKING
  // ════════════════════════════════════════════════════════════════

  /** POST /bookings/:bookingId/accept — Chấp nhận booking + Ký quỹ */
  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chấp nhận booking (+ Ký quỹ Credit cho Learner)' })
  @ApiResponse({ status: 200, description: 'Chấp nhận thành công', type: BookingResponseDto })
  async acceptBooking(@Param('id') id: string, @Req() req: any) {
    return this.bookingService.acceptBooking(req.user.id, id);
  }

  /** POST /bookings/:bookingId/complete — Hoàn thành buổi học & Giải phóng khoản ký quỹ */
  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hoàn thành buổi học & Giải phóng khoản ký quỹ Credit cho Mentor' })
  @ApiResponse({ status: 200, description: 'Hoàn thành buổi học thành công', type: BookingResponseDto })
  async completeBooking(@Param('id') id: string, @Req() req: any) {
    return this.bookingService.completeBooking(req.user.id, id);
  }

  /** POST /bookings/:bookingId/reject — Từ chối booking */
  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Từ chối booking' })
  @ApiBody({ type: RejectBookingDto })
  @ApiResponse({ status: 200, description: 'Đã từ chối booking', type: BookingResponseDto })
  async rejectBooking(@Param('id') id: string, @Body() body: RejectBookingDto, @Req() req: any) {
    return this.bookingService.rejectBooking(req.user.id, id, body?.reason);
  }

  /** POST /bookings/:bookingId/cancel — Hủy booking */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy booking (hoàn credit nếu đã ký quỹ)' })
  @ApiBody({ type: RejectBookingDto })
  @ApiResponse({ status: 200, description: 'Đã hủy booking' })
  async cancelBooking(@Param('id') id: string, @Body() body: RejectBookingDto, @Req() req: any) {
    return this.bookingService.cancelBooking(req.user.id, id, body?.reason);
  }

  /** POST /bookings/:bookingId/no-show — Đánh dấu không đến */
  @Post(':id/no-show')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh dấu đối tác không đến (Trust -15)' })
  @ApiResponse({ status: 200, description: 'Đã đánh dấu no-show' })
  async markNoShow(@Param('id') id: string, @Req() req: any) {
    return this.bookingService.markNoShow(req.user.id, id);
  }

  // ════════════════════════════════════════════════════════════════
  // TRUY VẤN BOOKING
  // ════════════════════════════════════════════════════════════════

  /** GET /bookings — Lấy danh sách Booking cá nhân */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách Booking cá nhân' })
  @ApiQuery({ name: 'role', required: false, enum: ['AS_LEARNER', 'AS_MENTOR', 'ALL'] })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Danh sách booking', type: GetBookingsResponseDto })
  async getMyBookings(@Query() query: GetBookingsQueryDto, @Req() req: any) {
    return this.bookingService.getMyBookings(req.user.id, query);
  }

  /** GET /bookings/mentor/:mentorId/busy-slots — Lấy danh sách khung giờ đã có lịch của Mentor */
  @Get('mentor/:mentorId/busy-slots')
  @ApiOperation({ summary: 'Lấy danh sách các khung giờ đã có lịch của Mentor (CONFIRMED / STARTED)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async getMentorBusySlots(
    @Param('mentorId') mentorId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingService.getBusySlots(mentorId, from, to);
  }

  /** GET /bookings/:bookingId — Chi tiết 1 Booking */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết 1 Booking' })
  @ApiResponse({ status: 200, description: 'Chi tiết booking', type: BookingResponseDto })
  async getBookingById(@Param('id') id: string) {
    return this.bookingService.getBookingById(id);
  }

  // ════════════════════════════════════════════════════════════════
  // TIN NHẮN TRAO ĐỔI TRƯỚC BUỔI HỌC (MESSAGING)
  // ════════════════════════════════════════════════════════════════

  /** GET /bookings/:id/messages — Lấy danh sách tin nhắn */
  @Get(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách tin nhắn của buổi học' })
  @ApiResponse({ status: 200, description: 'Danh sách tin nhắn', type: [BookingMessageResponseDto] })
  async getBookingMessages(@Param('id') id: string, @Req() req: any) {
    return this.bookingService.getBookingMessages(req.user.id, id);
  }

  /** POST /bookings/:id/messages — Gửi tin nhắn */
  @Post(':id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi tin nhắn trao đổi trong buổi học' })
  @ApiBody({ type: SendBookingMessageDto })
  @ApiResponse({ status: 201, description: 'Gửi tin nhắn thành công', type: BookingMessageResponseDto })
  async sendBookingMessage(
    @Param('id') id: string,
    @Body() dto: SendBookingMessageDto,
    @Req() req: any,
  ) {
    return this.bookingService.sendBookingMessage(req.user.id, id, dto);
  }

  /** POST /bookings/:id/typing — Báo hiệu trạng thái đang soạn tin */
  @Post(':id/typing')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật trạng thái đang soạn tin nhắn' })
  async setTypingStatus(
    @Param('id') id: string,
    @Body('typing') typing: boolean,
    @Req() req: any,
  ) {
    return this.bookingService.setTypingStatus(req.user.id, id, typing);
  }

  // ════════════════════════════════════════════════════════════════
  // RABBITMQ RPC PATTERNS
  // ════════════════════════════════════════════════════════════════

  @MessagePattern('booking.findById')
  async findByIdRmq(@Payload() data: { id: string }) {
    return this.bookingService.findByIdInternal(data.id);
  }

  @EventPattern('booking.updateStatus')
  async updateStatusEventRmq(@Payload() data: { id: string; status: any }) {
    return this.bookingService.updateStatusInternal(data.id, data.status);
  }

  @MessagePattern('booking.updateStatus')
  async updateStatusRpcRmq(@Payload() data: { id: string; status: any }) {
    return this.bookingService.updateStatusInternal(data.id, data.status);
  }
}

