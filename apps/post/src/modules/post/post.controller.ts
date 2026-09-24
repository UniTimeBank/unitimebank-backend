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
  // COMMUNITY GROUP MESSAGE PATTERNS (Facebook Groups)
  // ====================================================================

  @MessagePattern('post.group.create')
  async createGroup(@Payload() data: { creatorId: string; dto: any; userSnapshot?: any }) {
    return this.postService.createGroup(data.creatorId, data.dto, data.userSnapshot);
  }

  @MessagePattern('post.group.findAll')
  async getAllGroups(@Payload() query: any) {
    return this.postService.getAllGroups(query);
  }

  @MessagePattern('post.group.findOne')
  async getGroupById(@Payload() data: { groupId: string; currentUserId?: string }) {
    return this.postService.getGroupById(data.groupId, data.currentUserId);
  }

  @MessagePattern('post.group.join')
  async joinGroup(@Payload() data: { groupId: string; userId: string }) {
    return this.postService.joinGroup(data.groupId, data.userId);
  }

  @MessagePattern('post.group.leave')
  async leaveGroup(@Payload() data: { groupId: string; userId: string }) {
    return this.postService.leaveGroup(data.groupId, data.userId);
  }

  @MessagePattern('post.group.post.create')
  async createGroupPost(
    @Payload() data: { groupId: string; authorId: string; dto: any; userSnapshot?: any },
  ) {
    return this.postService.createGroupPost(data.groupId, data.authorId, data.dto, data.userSnapshot);
  }

  @MessagePattern('post.group.post.findAll')
  async getGroupPosts(@Payload() data: { groupId: string; currentUserId?: string }) {
    return this.postService.getGroupPosts(data.groupId, data.currentUserId);
  }

  @MessagePattern('post.group.post.toggleLike')
  async toggleLikeGroupPost(@Payload() data: { groupId: string; postId: string; userId: string }) {
    return this.postService.toggleLikeGroupPost(data.groupId, data.postId, data.userId);
  }

  @MessagePattern('post.group.post.delete')
  async deleteGroupPost(@Payload() data: { groupId: string; postId: string; userId: string }) {
    return this.postService.deleteGroupPost(data.groupId, data.postId, data.userId);
  }

  @MessagePattern('post.group.comment.create')
  async createGroupComment(
    @Payload() data: { groupId: string; postId: string; authorId: string; dto: any; userSnapshot?: any },
  ) {
    return this.postService.createGroupComment(data.groupId, data.postId, data.authorId, data.dto, data.userSnapshot);
  }

  @MessagePattern('post.group.comment.findAll')
  async getGroupComments(@Payload() data: { postId: string }) {
    return this.postService.getGroupComments(data.postId);
  }

  @MessagePattern('post.group.comment.delete')
  async deleteGroupComment(@Payload() data: { commentId: string; userId: string }) {
    return this.postService.deleteGroupComment(data.commentId, data.userId);
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
