import { Controller } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import { PostService } from './post.service';
import {
  CreateMentorPostDto,
  UpdateMentorPostDto,
  GetMentorPostsQueryDto,
  CreateLearnerRequestDto,
  UpdateLearnerRequestDto,
  GetLearnerRequestsQueryDto,
  SearchPostsQueryDto,
} from '@app/contracts/post';
import { POST_EVENTS, MODERATION_EVENTS } from '@app/contracts/events';

@Controller()
export class PostController {
  constructor(private readonly postService: PostService) {}

  // ====================================================================
  // MENTOR POST MESSAGE PATTERNS
  // ====================================================================

  @MessagePattern('post.mentor.create')
  async createMentorPost(
    @Payload() data: { mentorId: string; dto: CreateMentorPostDto; userSnapshot?: any },
  ) {
    return this.postService.createMentorPost(data.mentorId, data.dto, data.userSnapshot);
  }

  @MessagePattern('post.mentor.findMy')
  async getMyMentorPosts(@Payload() data: { mentorId: string; query: GetMentorPostsQueryDto }) {
    return this.postService.getMyMentorPosts(data.mentorId, data.query);
  }

  @MessagePattern('post.mentor.findAll')
  async getMentorPosts(@Payload() query: GetMentorPostsQueryDto) {
    return this.postService.getMentorPosts(query);
  }

  @MessagePattern('post.mentor.findOne')
  async getMentorPostById(@Payload() data: { id: string }) {
    return this.postService.getMentorPostById(data.id);
  }

  @MessagePattern('post.mentor.update')
  async updateMentorPost(
    @Payload() data: { id: string; mentorId: string; dto: UpdateMentorPostDto },
  ) {
    return this.postService.updateMentorPost(data.id, data.mentorId, data.dto);
  }

  @MessagePattern('post.mentor.close')
  async closeMentorPost(@Payload() data: { id: string; mentorId: string }) {
    return this.postService.closeMentorPost(data.id, data.mentorId);
  }

  @MessagePattern('post.mentor.delete')
  async deleteMentorPost(@Payload() data: { id: string; mentorId: string }) {
    return this.postService.deleteMentorPost(data.id, data.mentorId);
  }

  // ====================================================================
  // LEARNER REQUEST MESSAGE PATTERNS
  // ====================================================================

  @MessagePattern('post.learner.create')
  async createLearnerRequest(
    @Payload() data: { learnerId: string; dto: CreateLearnerRequestDto; userSnapshot?: any },
  ) {
    return this.postService.createLearnerRequest(data.learnerId, data.dto, data.userSnapshot);
  }

  @MessagePattern('post.learner.findMy')
  async getMyLearnerRequests(
    @Payload() data: { learnerId: string; query: GetLearnerRequestsQueryDto },
  ) {
    return this.postService.getMyLearnerRequests(data.learnerId, data.query);
  }

  @MessagePattern('post.learner.findAll')
  async getLearnerRequests(@Payload() query: GetLearnerRequestsQueryDto) {
    return this.postService.getLearnerRequests(query);
  }

  @MessagePattern('post.learner.findOne')
  async getLearnerRequestById(@Payload() data: { id: string }) {
    return this.postService.getLearnerRequestById(data.id);
  }

  @MessagePattern('post.learner.update')
  async updateLearnerRequest(
    @Payload() data: { id: string; learnerId: string; dto: UpdateLearnerRequestDto },
  ) {
    return this.postService.updateLearnerRequest(data.id, data.learnerId, data.dto);
  }

  @MessagePattern('post.learner.cancel')
  async cancelLearnerRequest(@Payload() data: { id: string; learnerId: string }) {
    return this.postService.cancelLearnerRequest(data.id, data.learnerId);
  }

  // ====================================================================
  // SEARCH & RECOMMENDATIONS MESSAGE PATTERNS
  // ====================================================================

  @MessagePattern('post.search')
  async searchCombined(@Payload() query: SearchPostsQueryDto) {
    return this.postService.searchCombined(query);
  }

  @MessagePattern('post.suggestions')
  async getSuggestions(@Payload() data: { q: string }) {
    return this.postService.getSuggestions(data.q);
  }

  @MessagePattern('post.recommendations')
  async getRecommendations(@Payload() data: { userId?: string; skills?: string[] }) {
    return this.postService.getRecommendations(data.userId, data.skills);
  }

  // ====================================================================
  // EVENT PATTERN CONSUMERS (RABBITMQ ASYNC EVENTS)
  // ====================================================================

  @EventPattern(POST_EVENTS.POST_MODERATED)
  async handlePostModerated(@Payload() data: any) {
    await this.postService.handlePostModerated(data);
  }

  @EventPattern(POST_EVENTS.USER_PROFILE_UPDATED)
  async handleUserProfileUpdated(@Payload() data: any) {
    await this.postService.handleUserProfileUpdated(data);
  }

  @EventPattern(POST_EVENTS.USER_TRUST_SCORE_UPDATED)
  async handleUserTrustScoreUpdated(@Payload() data: any) {
    await this.postService.handleUserProfileUpdated(data);
  }

  @EventPattern(MODERATION_EVENTS.TRUST_SCORE_UPDATED)
  async handleModerationTrustScoreUpdated(@Payload() data: { userId: string; score: number }) {
    await this.postService.handleUserProfileUpdated({
      userId: data.userId,
      trustScore: data.score,
    });
  }
}
