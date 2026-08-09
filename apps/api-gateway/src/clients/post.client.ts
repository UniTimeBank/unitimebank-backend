import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  CreateMentorPostDto,
  UpdateMentorPostDto,
  GetMentorPostsQueryDto,
  GetMentorPostsResponseDto,
  MentorPostResponseDto,
  CreateLearnerRequestDto,
  UpdateLearnerRequestDto,
  GetLearnerRequestsQueryDto,
  GetLearnerRequestsResponseDto,
  LearnerRequestResponseDto,
  SearchPostsQueryDto,
  SearchPostsResponseDto,
  PostRecommendationsResponseDto,
  PostSuggestionsResponseDto,
} from '@app/contracts/post';

@Injectable()
export class PostClient {
  private client: ClientProxy;

  constructor() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: 'post_queue',
        queueOptions: { durable: false },
      },
    });
  }

  send<T>(pattern: string, data: any): Promise<T> {
    return firstValueFrom(this.client.send<T>(pattern, data).pipe(timeout(10000)));
  }

  emit<T>(pattern: string, data: any) {
    return this.client.emit(pattern, data);
  }

  // Mentor Post Methods
  createMentorPost(mentorId: string, dto: CreateMentorPostDto, userSnapshot?: any): Promise<MentorPostResponseDto> {
    return this.send('post.mentor.create', { mentorId, dto, userSnapshot });
  }

  getMyMentorPosts(mentorId: string, query: GetMentorPostsQueryDto): Promise<GetMentorPostsResponseDto> {
    return this.send('post.mentor.findMy', { mentorId, query });
  }

  getMentorPosts(query: GetMentorPostsQueryDto): Promise<GetMentorPostsResponseDto> {
    return this.send('post.mentor.findAll', query);
  }

  getMentorPostById(id: string): Promise<MentorPostResponseDto> {
    return this.send('post.mentor.findOne', { id });
  }

  updateMentorPost(id: string, mentorId: string, dto: UpdateMentorPostDto): Promise<MentorPostResponseDto> {
    return this.send('post.mentor.update', { id, mentorId, dto });
  }

  closeMentorPost(id: string, mentorId: string): Promise<MentorPostResponseDto> {
    return this.send('post.mentor.close', { id, mentorId });
  }

  deleteMentorPost(id: string, mentorId: string): Promise<MentorPostResponseDto> {
    return this.send('post.mentor.delete', { id, mentorId });
  }

  // Learner Request Methods
  createLearnerRequest(learnerId: string, dto: CreateLearnerRequestDto, userSnapshot?: any): Promise<LearnerRequestResponseDto> {
    return this.send('post.learner.create', { learnerId, dto, userSnapshot });
  }

  getMyLearnerRequests(learnerId: string, query: GetLearnerRequestsQueryDto): Promise<GetLearnerRequestsResponseDto> {
    return this.send('post.learner.findMy', { learnerId, query });
  }

  getLearnerRequests(query: GetLearnerRequestsQueryDto): Promise<GetLearnerRequestsResponseDto> {
    return this.send('post.learner.findAll', query);
  }

  getLearnerRequestById(id: string): Promise<LearnerRequestResponseDto> {
    return this.send('post.learner.findOne', { id });
  }

  updateLearnerRequest(id: string, learnerId: string, dto: UpdateLearnerRequestDto): Promise<LearnerRequestResponseDto> {
    return this.send('post.learner.update', { id, learnerId, dto });
  }

  cancelLearnerRequest(id: string, learnerId: string): Promise<LearnerRequestResponseDto> {
    return this.send('post.learner.cancel', { id, learnerId });
  }

  // Search & Recommendations Methods
  searchCombined(query: SearchPostsQueryDto): Promise<SearchPostsResponseDto> {
    return this.send('post.search', query);
  }

  getSuggestions(q: string): Promise<PostSuggestionsResponseDto> {
    return this.send('post.suggestions', { q });
  }

  getRecommendations(userId?: string, skills?: string[]): Promise<PostRecommendationsResponseDto> {
    return this.send('post.recommendations', { userId, skills });
  }
}
