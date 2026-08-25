import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { ModerationClient } from '../clients/moderation.client';
import {
  CreateRatingDto,
  CreateViolationReportDto,
  ResolveReportDto,
} from '@app/contracts';

@ApiTags('Moderation - Đánh giá, Điểm uy tín & Khiếu nại vi phạm')
@Controller('moderation')
export class ModerationRoutes {
  constructor(private readonly moderationClient: ModerationClient) {}

  // ════════════════════════════════════════════════════════════════
  // 1. ĐÁNH GIÁ SAU BUỔI HỌC (POST-SESSION RATINGS & REVIEWS)
  // ════════════════════════════════════════════════════════════════

  @Post('ratings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi đánh giá và nhận xét sau buổi học' })
  @ApiResponse({ status: 201, description: 'Đánh giá thành công' })
  async createRating(@Body() body: CreateRatingDto, @Req() req: any) {
    const reviewerId = req.user.id;
    return this.moderationClient.send('moderation.createRating', {
      reviewerId,
      dto: body,
    });
  }

  @Get('ratings/user/:userId')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá của người dùng và điểm sao trung bình' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRatingsByUser(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.moderationClient.send('moderation.getRatingsByUser', {
      userId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get('ratings/booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kiểm tra đánh giá theo bookingId' })
  async getRatingByBooking(@Param('bookingId') bookingId: string) {
    return this.moderationClient.send('moderation.getRatingByBooking', {
      bookingId,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 2. ĐIỂM UY TÍN (TRUST SCORE)
  // ════════════════════════════════════════════════════════════════

  @Get('trust-score/:userId')
  @ApiOperation({ summary: 'Lấy điểm uy tín và phân hạng (Tier) của người dùng' })
  async getTrustScore(@Param('userId') userId: string) {
    return this.moderationClient.send('moderation.getTrustScore', { userId });
  }

  @Get('trust-score/:userId/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử biến động điểm uy tín' })
  async getTrustScoreHistory(@Param('userId') userId: string) {
    return this.moderationClient.send('moderation.getTrustScoreHistory', {
      userId,
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 3. BÁO CÁO VI PHẠM (VIOLATION REPORTS)
  // ════════════════════════════════════════════════════════════════

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gửi báo cáo vi phạm đính kèm bằng chứng' })
  async createReport(@Body() body: CreateViolationReportDto, @Req() req: any) {
    const reporterId = req.user.id;
    return this.moderationClient.send('moderation.createReport', {
      reporterId,
      dto: body,
    });
  }

  @Get('reports/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem danh sách báo cáo vi phạm do chính mình gửi' })
  async getMyReports(@Req() req: any) {
    const reporterId = req.user.id;
    return this.moderationClient.send('moderation.getMyReports', {
      reporterId,
    });
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản trị viên lấy danh sách toàn bộ báo cáo vi phạm' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getReports(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.moderationClient.send('moderation.getReports', {
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Put('reports/:id/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quản trị viên xử lý báo cáo vi phạm' })
  async resolveReport(
    @Param('id') id: string,
    @Body() body: ResolveReportDto,
    @Req() req: any,
  ) {
    const moderatorId = req.user.id;
    return this.moderationClient.send('moderation.resolveReport', {
      moderatorId,
      dto: { ...body, reportId: id },
    });
  }
}
