import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ModerationService } from './moderation.service';
import {
  CreateRatingDto,
  CreateViolationReportDto,
  ResolveReportDto,
} from '@app/contracts';

@Controller()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  // ==================== RATINGS ====================

  @MessagePattern('moderation.createRating')
  async createRating(@Payload() data: { reviewerId: string; dto: CreateRatingDto }) {
    return this.moderationService.createRating(data.reviewerId, data.dto);
  }

  @MessagePattern('moderation.getRatingsByUser')
  async getRatingsByUser(@Payload() data: { userId: string; page?: number; limit?: number }) {
    return this.moderationService.getRatingsByUser(data.userId, data.page, data.limit);
  }

  @MessagePattern('moderation.getRatingByBooking')
  async getRatingByBooking(@Payload() data: { bookingId: string }) {
    return this.moderationService.getRatingByBooking(data.bookingId);
  }

  // ==================== TRUST SCORE ====================

  @MessagePattern('moderation.getTrustScore')
  async getTrustScore(@Payload() data: { userId: string }) {
    return this.moderationService.getTrustScore(data.userId);
  }

  @MessagePattern('moderation.getTrustScoreHistory')
  async getTrustScoreHistory(@Payload() data: { userId: string }) {
    return this.moderationService.getTrustScoreHistory(data.userId);
  }

  // ==================== VIOLATION REPORTS ====================

  @MessagePattern('moderation.createReport')
  async createReport(@Payload() data: { reporterId: string; dto: CreateViolationReportDto }) {
    return this.moderationService.createReport(data.reporterId, data.dto);
  }

  @MessagePattern('moderation.getMyReports')
  async getMyReports(@Payload() data: { reporterId: string }) {
    return this.moderationService.getMyReports(data.reporterId);
  }

  @MessagePattern('moderation.getReports')
  async getReports(@Payload() data: { status?: any; page?: number; limit?: number }) {
    return this.moderationService.getReports(data.status, data.page, data.limit);
  }

  @MessagePattern('moderation.resolveReport')
  async resolveReport(@Payload() data: { moderatorId: string; dto: ResolveReportDto }) {
    return this.moderationService.resolveReport(data.moderatorId, data.dto);
  }
}
