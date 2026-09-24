import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Model, Types } from 'mongoose';
import {
  MentorPost,
  MentorPostDocument,
  LearnerRequest,
  LearnerRequestDocument,
  CommunityGroup,
  CommunityGroupDocument,
  GroupPost,
  GroupPostDocument,
  GroupComment,
  GroupCommentDocument,
} from './schemas';
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
  PostStatus,
  LearnerRequestStatus,
  ModerationDecision,
  CreateCommunityGroupDto,
  CreateGroupPostDto,
  CreateGroupCommentDto,
  CommunityGroupResponseDto,
  GroupPostResponseDto,
  GroupCommentResponseDto,
} from '@app/contracts/post';
import {
  PostCreatedEvent,
  PostModeratedEvent,
  UserProfileUpdatedEvent,
  POST_EVENTS,
} from '@app/contracts/events';

@Injectable()
export class PostService implements OnModuleInit {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @InjectModel(MentorPost.name)
    private readonly mentorPostModel: Model<MentorPostDocument>,
    @InjectModel(LearnerRequest.name)
    private readonly learnerRequestModel: Model<LearnerRequestDocument>,
    @InjectModel(CommunityGroup.name)
    private readonly groupModel: Model<CommunityGroupDocument>,
    @InjectModel(GroupPost.name)
    private readonly groupPostModel: Model<GroupPostDocument>,
    @InjectModel(GroupComment.name)
    private readonly groupCommentModel: Model<GroupCommentDocument>,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  async onModuleInit() {
    // Không tự động seed dữ liệu mẫu - hệ thống sử dụng dữ liệu thực tế do người dùng tạo
  }

  // ====================================================================
  // 1. MENTOR POST OPERATIONS (UC-02.1)
  // ====================================================================

  /** Tạo bài đăng nhận dạy mới và phát sự kiện post.created */
  async createMentorPost(
    mentorId: string,
    dto: CreateMentorPostDto,
    userSnapshot?: { name?: string; avatar?: string; trustScore?: number },
  ): Promise<MentorPostResponseDto> {
    const post = new this.mentorPostModel({
      mentorId,
      mentorName: userSnapshot?.name || 'Mentor',
      mentorAvatar: userSnapshot?.avatar || '',
      title: dto.title,
      description: dto.description || '',
      shortDescription: dto.shortDescription || '',
      sessionType: dto.sessionType || 'BOTH',
      scheduleType: dto.scheduleType || 'ALWAYS_OPEN',
      startDate: dto.startDate,
      endDate: dto.endDate,
      tags: dto.tags || [],
      availableSlots: dto.availableSlots || [],
      trustScoreSnapshot: userSnapshot?.trustScore || 100,
      status: PostStatus.PUBLISHED,
    });

    const saved = await post.save();
    const resultDto = this.mapMentorPostToDto(saved);

    // 📢 Phát sự kiện post.created sang Notification Service qua RabbitMQ
    try {
      const eventPayload: PostCreatedEvent = {
        postId: resultDto._id,
        mentorId: resultDto.mentorId,
        mentorName: resultDto.mentorName || 'Mentor',
        mentorAvatar: resultDto.mentorAvatar,
        title: resultDto.title,
        sessionType: resultDto.sessionType,
        tags: resultDto.tags as any,
        createdAt: resultDto.createdAt,
      };
      this.notificationClient.emit(POST_EVENTS.POST_CREATED, eventPayload);
      this.logger.log(`Emitted event ${POST_EVENTS.POST_CREATED} for post: ${resultDto._id}`);
    } catch (err) {
      this.logger.error(`Failed to emit ${POST_EVENTS.POST_CREATED}: ${err.message}`);
    }

    return resultDto;
  }

  /** Lấy danh sách bài đăng của chính Mentor */
  async getMyMentorPosts(
    mentorId: string,
    query: GetMentorPostsQueryDto,
  ): Promise<GetMentorPostsResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const filter: any = { mentorId, status: { $ne: PostStatus.ARCHIVED } };
    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.mentorPostModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.mentorPostModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((p) => this.mapMentorPostToDto(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** Lấy danh sách bài dạy công khai kèm đa bộ lọc */
  async getMentorPosts(query: GetMentorPostsQueryDto): Promise<GetMentorPostsResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const filter: any = {
      status: query.status || PostStatus.PUBLISHED,
    };

    if (query.category) {
      filter['tags.category'] = query.category;
    }

    if (query.skill) {
      filter['tags.skillName'] = { $regex: query.skill, $options: 'i' };
    }

    if (query.sessionType) {
      filter.sessionType = { $in: [query.sessionType, 'BOTH'] };
    }

    if (query.trustScoreMin) {
      filter.trustScoreSnapshot = { $gte: Number(query.trustScoreMin) };
    }

    if (query.dayOfWeek) {
      filter['availableSlots.dayOfWeek'] = query.dayOfWeek.toUpperCase();
    }

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
        { 'tags.skillName': { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.mentorPostModel
        .find(filter)
        .sort({ trustScoreSnapshot: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.mentorPostModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((p) => this.mapMentorPostToDto(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** Lấy chi tiết bài dạy */
  async getMentorPostById(id: string): Promise<MentorPostResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID bài đăng không hợp lệ');
    }
    const post = await this.mentorPostModel.findById(id).exec();
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài đăng nhận dạy');
    }
    return this.mapMentorPostToDto(post);
  }

  /** Cập nhật bài dạy của Mentor */
  async updateMentorPost(
    id: string,
    mentorId: string,
    dto: UpdateMentorPostDto,
  ): Promise<MentorPostResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID bài đăng không hợp lệ');
    }
    const post = await this.mentorPostModel.findById(id).exec();
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài đăng nhận dạy');
    }
    if (post.mentorId !== mentorId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài đăng này');
    }

    if (dto.title !== undefined) post.title = dto.title;
    if (dto.description !== undefined) post.description = dto.description;
    if (dto.sessionType !== undefined) post.sessionType = dto.sessionType;
    if (dto.tags !== undefined) post.tags = dto.tags as any;
    if (dto.availableSlots !== undefined) post.availableSlots = dto.availableSlots as any;
    if (dto.status !== undefined) post.status = dto.status;

    const updated = await post.save();
    return this.mapMentorPostToDto(updated);
  }

  /** Đóng bài dạy (Ngừng nhận học viên) */
  async closeMentorPost(id: string, mentorId: string): Promise<MentorPostResponseDto> {
    return this.updateMentorPost(id, mentorId, { status: PostStatus.CLOSED });
  }

  /** Xóa mềm bài đăng của Mentor */
  async deleteMentorPost(id: string, mentorId: string): Promise<MentorPostResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID bài đăng không hợp lệ');
    }
    const post = await this.mentorPostModel.findById(id).exec();
    if (!post) {
      throw new NotFoundException('Không tìm thấy bài đăng nhận dạy');
    }
    if (post.mentorId !== mentorId) {
      throw new ForbiddenException('Bạn không có quyền xóa bài đăng này');
    }

    post.status = PostStatus.ARCHIVED;
    post.removedAt = new Date();
    const updated = await post.save();
    return this.mapMentorPostToDto(updated);
  }

  // ====================================================================
  // 2. LEARNER REQUEST OPERATIONS (UC-02.2)
  // ====================================================================

  /** Tạo bài tìm người dạy mới (1 phút = 1 Credit) */
  async createLearnerRequest(
    learnerId: string,
    dto: CreateLearnerRequestDto,
    userSnapshot?: { name?: string; avatar?: string },
  ): Promise<LearnerRequestResponseDto> {
    const duration = dto.expectedDurationMinutes || 60;
    const creditAmount = duration; // 1 phút = 1 Credit

    const request = new this.learnerRequestModel({
      learnerId,
      learnerName: userSnapshot?.name || 'Learner',
      learnerAvatar: userSnapshot?.avatar || '',
      skillNeeded: dto.skillNeeded,
      category: dto.category,
      description: dto.description || '',
      shortDescription: dto.shortDescription || '',
      sessionType: dto.sessionType || 'ONE_ON_ONE',
      expectedDurationMinutes: duration,
      expectedCreditAmount: creditAmount,
      desiredSlots: dto.desiredSlots || [],
      status: LearnerRequestStatus.OPEN,
    });

    const saved = await request.save();
    return this.mapLearnerRequestToDto(saved);
  }

  /** Lấy danh sách yêu cầu của chính Learner */
  async getMyLearnerRequests(
    learnerId: string,
    query: GetLearnerRequestsQueryDto,
  ): Promise<GetLearnerRequestsResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const filter: any = {
      learnerId,
      $or: [{ removedAt: { $exists: false } }, { removedAt: null }],
    };
    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.learnerRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.learnerRequestModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((r) => this.mapLearnerRequestToDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** Lấy danh sách yêu cầu tìm mentor công khai */
  async getLearnerRequests(query: GetLearnerRequestsQueryDto): Promise<GetLearnerRequestsResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const filter: any = {
      status: query.status || LearnerRequestStatus.OPEN,
    };

    if (query.category) {
      filter.category = query.category;
    }

    if (query.sessionType) {
      filter.sessionType = query.sessionType;
    }

    if (query.search) {
      filter.$or = [
        { skillNeeded: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.learnerRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.learnerRequestModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((r) => this.mapLearnerRequestToDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** Lấy chi tiết bài yêu cầu */
  async getLearnerRequestById(id: string): Promise<LearnerRequestResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID yêu cầu không hợp lệ');
    }
    const request = await this.learnerRequestModel.findById(id).exec();
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu tìm người dạy');
    }
    return this.mapLearnerRequestToDto(request);
  }

  /** Cập nhật bài yêu cầu */
  async updateLearnerRequest(
    id: string,
    learnerId: string,
    dto: UpdateLearnerRequestDto,
  ): Promise<LearnerRequestResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID yêu cầu không hợp lệ');
    }
    const request = await this.learnerRequestModel.findById(id).exec();
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu tìm người dạy');
    }
    if (request.learnerId !== learnerId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa yêu cầu này');
    }

    if (dto.skillNeeded !== undefined) request.skillNeeded = dto.skillNeeded;
    if (dto.category !== undefined) request.category = dto.category;
    if (dto.description !== undefined) request.description = dto.description;
    if (dto.sessionType !== undefined) request.sessionType = dto.sessionType;
    if (dto.expectedDurationMinutes !== undefined) {
      request.expectedDurationMinutes = dto.expectedDurationMinutes;
      request.expectedCreditAmount = dto.expectedDurationMinutes; // 1 phút = 1 Credit
    }
    if (dto.desiredSlots !== undefined) request.desiredSlots = dto.desiredSlots as any;
    if (dto.status !== undefined) request.status = dto.status;

    const updated = await request.save();
    return this.mapLearnerRequestToDto(updated);
  }

  /** Hủy / Xóa mềm bài yêu cầu */
  async cancelLearnerRequest(id: string, learnerId: string): Promise<LearnerRequestResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID yêu cầu không hợp lệ');
    }
    const request = await this.learnerRequestModel.findById(id).exec();
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu tìm người dạy');
    }
    if (request.learnerId !== learnerId) {
      throw new ForbiddenException('Bạn không có quyền xóa yêu cầu này');
    }
    request.status = LearnerRequestStatus.CANCELLED;
    request.removedAt = new Date();
    const updated = await request.save();
    return this.mapLearnerRequestToDto(updated);
  }

  // ====================================================================
  // 3. MULTI-DIMENSIONAL SEARCH & LIVE SUGGESTIONS (UC-02.3)
  // ====================================================================

  /** Gợi ý từ khóa tức thì (Live Instant Suggestions) khi người dùng gõ vào SearchBar */
  async getSuggestions(q: string): Promise<PostSuggestionsResponseDto> {
    if (!q || q.trim().length === 0) {
      return { skills: [], titles: [], categories: [] };
    }

    const regex = new RegExp(q.trim(), 'i');

    const [skillTags, mentorTitles, learnerSkills] = await Promise.all([
      this.mentorPostModel.distinct('tags.skillName', {
        'tags.skillName': regex,
        status: PostStatus.PUBLISHED,
      }),
      this.mentorPostModel
        .find({ title: regex, status: PostStatus.PUBLISHED })
        .select('title')
        .limit(5)
        .exec(),
      this.learnerRequestModel.distinct('skillNeeded', {
        skillNeeded: regex,
        status: LearnerRequestStatus.OPEN,
      }),
    ]);

    const combinedSkills = Array.from(new Set([...skillTags, ...learnerSkills])).slice(0, 8);
    const titles = mentorTitles.map((p) => p.title);

    const categories = await this.mentorPostModel.distinct('tags.category', {
      'tags.skillName': { $in: combinedSkills },
      status: PostStatus.PUBLISHED,
    });

    return {
      skills: combinedSkills,
      titles,
      categories: categories.filter(Boolean),
    };
  }

  /** Tìm kiếm đa chiều kết hợp Mentor Post & Learner Request */
  async searchCombined(query: SearchPostsQueryDto): Promise<SearchPostsResponseDto> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 12);
    const halfLimit = Math.ceil(limit / 2);

    const mentorFilter: any = { status: PostStatus.PUBLISHED };
    const learnerFilter: any = { status: LearnerRequestStatus.OPEN };

    if (query.q) {
      const qRegex = { $regex: query.q, $options: 'i' };
      mentorFilter.$or = [{ title: qRegex }, { description: qRegex }, { 'tags.skillName': qRegex }];
      learnerFilter.$or = [{ skillNeeded: qRegex }, { description: qRegex }];
    }

    if (query.category) {
      mentorFilter['tags.category'] = query.category;
      learnerFilter.category = query.category;
    }

    if (query.sessionType) {
      mentorFilter.sessionType = { $in: [query.sessionType, 'BOTH'] };
      learnerFilter.sessionType = query.sessionType;
    }

    if (query.trustScoreMin) {
      mentorFilter.trustScoreSnapshot = { $gte: Number(query.trustScoreMin) };
    }

    if (query.dayOfWeek) {
      mentorFilter['availableSlots.dayOfWeek'] = query.dayOfWeek.toUpperCase();
      learnerFilter['desiredSlots.dayOfWeek'] = query.dayOfWeek.toUpperCase();
    }

    const sortOption: any =
      query.sortBy === 'trustScore'
        ? { trustScoreSnapshot: -1, createdAt: -1 }
        : { createdAt: -1 };

    const [mentorItems, learnerItems, mentorTotal, learnerTotal] = await Promise.all([
      this.mentorPostModel.find(mentorFilter).sort(sortOption).limit(halfLimit).exec(),
      this.learnerRequestModel.find(learnerFilter).sort({ createdAt: -1 }).limit(halfLimit).exec(),
      this.mentorPostModel.countDocuments(mentorFilter).exec(),
      this.learnerRequestModel.countDocuments(learnerFilter).exec(),
    ]);

    return {
      mentorPosts: mentorItems.map((p) => this.mapMentorPostToDto(p)),
      learnerRequests: learnerItems.map((r) => this.mapLearnerRequestToDto(r)),
      total: mentorTotal + learnerTotal,
      page,
      limit,
    };
  }

  // ====================================================================
  // 4. PERSONALIZED RECOMMENDATIONS (UC-02.4)
  // ====================================================================

  /** Gợi ý bài đăng cá nhân hóa cho sinh viên */
  async getRecommendations(
    userId?: string,
    userInterestSkills: string[] = [],
  ): Promise<PostRecommendationsResponseDto> {
    const mentorFilter: any = { status: PostStatus.PUBLISHED };
    const learnerFilter: any = { status: LearnerRequestStatus.OPEN };

    if (userInterestSkills && userInterestSkills.length > 0) {
      mentorFilter['tags.skillName'] = { $in: userInterestSkills.map((s) => new RegExp(s, 'i')) };
      learnerFilter.skillNeeded = { $in: userInterestSkills.map((s) => new RegExp(s, 'i')) };
    }

    const [mentorPosts, learnerRequests] = await Promise.all([
      this.mentorPostModel
        .find(mentorFilter)
        .sort({ trustScoreSnapshot: -1, createdAt: -1 })
        .limit(6)
        .exec(),
      this.learnerRequestModel.find(learnerFilter).sort({ createdAt: -1 }).limit(6).exec(),
    ]);

    let fallbackMentorPosts: MentorPostDocument[] = mentorPosts as MentorPostDocument[];
    if (fallbackMentorPosts.length < 3) {
      fallbackMentorPosts = (await this.mentorPostModel
        .find({ status: PostStatus.PUBLISHED } as any)
        .sort({ trustScoreSnapshot: -1, createdAt: -1 })
        .limit(6)
        .exec()) as MentorPostDocument[];
    }

    let fallbackLearnerRequests: LearnerRequestDocument[] = learnerRequests as LearnerRequestDocument[];
    if (fallbackLearnerRequests.length < 3) {
      fallbackLearnerRequests = (await this.learnerRequestModel
        .find({ status: LearnerRequestStatus.OPEN } as any)
        .sort({ createdAt: -1 })
        .limit(6)
        .exec()) as LearnerRequestDocument[];
    }

    return {
      recommendedMentorPosts: fallbackMentorPosts.map((p) => this.mapMentorPostToDto(p)),
      recommendedLearnerRequests: fallbackLearnerRequests.map((r) => this.mapLearnerRequestToDto(r)),
    };
  }

  // ====================================================================
  // 5. EVENT CONSUMERS (INTER-MICROSERVICE SYNC)
  // ====================================================================

  /** Xử lý sự kiện Hậu kiểm bài đăng từ Moderation Service */
  async handlePostModerated(event: PostModeratedEvent): Promise<void> {
    this.logger.log(`Processing post.moderated event for ${event.postType} ID: ${event.postId}`);

    const isRemoved = event.decision === 'REMOVE' || event.decision === ModerationDecision.REJECTED;

    if (event.postType === 'MENTOR_POST' || !event.postType) {
      if (Types.ObjectId.isValid(event.postId)) {
        await this.mentorPostModel.findByIdAndUpdate(event.postId, {
          moderation: {
            decision: event.decision,
            reason: event.reason || '',
            moderatorId: event.moderatorId,
            decidedAt: new Date(event.decidedAt || Date.now()),
          },
          ...(isRemoved && {
            status: PostStatus.ARCHIVED,
            removedAt: new Date(),
          }),
        });
      }
    } else if (event.postType === 'LEARNER_REQUEST') {
      if (Types.ObjectId.isValid(event.postId)) {
        await this.learnerRequestModel.findByIdAndUpdate(event.postId, {
          ...(isRemoved && {
            status: LearnerRequestStatus.CANCELLED,
            removedAt: new Date(),
          }),
        });
      }
    }
  }

  /** Đồng bộ thông tin Snapshot khi User Profile thay đổi (tên, avatar, trustScore) */
  async handleUserProfileUpdated(event: UserProfileUpdatedEvent): Promise<void> {
    this.logger.log(`Syncing profile snapshots for User ID: ${event.userId}`);

    const updateFields: any = {};
    if (event.displayName) updateFields.mentorName = event.displayName;
    if (event.avatarUrl) updateFields.mentorAvatar = event.avatarUrl;
    if (event.trustScore !== undefined) updateFields.trustScoreSnapshot = event.trustScore;

    const learnerUpdateFields: any = {};
    if (event.displayName) learnerUpdateFields.learnerName = event.displayName;
    if (event.avatarUrl) learnerUpdateFields.learnerAvatar = event.avatarUrl;

    await Promise.all([
      this.mentorPostModel.updateMany({ mentorId: event.userId }, { $set: updateFields }).exec(),
      this.learnerRequestModel.updateMany({ learnerId: event.userId }, { $set: learnerUpdateFields }).exec(),
    ]);
  }

  // ====================================================================
  // HELPER MAPPERS
  // ====================================================================

  private mapMentorPostToDto(doc: any): MentorPostResponseDto {
    return {
      _id: doc._id.toString(),
      mentorId: doc.mentorId,
      mentorName: doc.mentorName,
      mentorAvatar: doc.mentorAvatar,
      title: doc.title,
      description: doc.description,
      shortDescription: doc.shortDescription,
      sessionType: doc.sessionType,
      scheduleType: doc.scheduleType || 'ALWAYS_OPEN',
      startDate: doc.startDate,
      endDate: doc.endDate,
      tags: doc.tags || [],
      availableSlots: doc.availableSlots || [],
      trustScoreSnapshot: doc.trustScoreSnapshot ?? 100,
      status: doc.status,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  private mapLearnerRequestToDto(doc: any): LearnerRequestResponseDto {
    return {
      _id: doc._id.toString(),
      learnerId: doc.learnerId,
      learnerName: doc.learnerName,
      learnerAvatar: doc.learnerAvatar,
      skillNeeded: doc.skillNeeded,
      category: doc.category,
      description: doc.description,
      shortDescription: doc.shortDescription,
      sessionType: doc.sessionType,
      expectedDurationMinutes: doc.expectedDurationMinutes ?? 60,
      expectedCreditAmount: doc.expectedCreditAmount ?? 60,
      desiredSlots: doc.desiredSlots || [],
      status: doc.status,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  // ====================================================================
  // 6. COMMUNITY GROUP OPERATIONS (Facebook Group Style)
  // ====================================================================

  /** Tạo nhóm cộng đồng mới */
  async createGroup(
    creatorId: string,
    dto: CreateCommunityGroupDto,
    userSnapshot?: { name?: string; avatar?: string },
  ): Promise<CommunityGroupResponseDto> {
    const group = new this.groupModel({
      name: dto.name,
      description: dto.description,
      coverImage: dto.coverImage || dto.coverUrl || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop',
      avatarUrl: dto.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
      category: dto.category || 'Công nghệ thông tin',
      creatorId,
      creatorName: userSnapshot?.name || 'Thành viên',
      creatorAvatar: userSnapshot?.avatar || '',
      memberIds: [creatorId],
      membersCount: 1,
      postsCount: 0,
      rules: dto.rules && dto.rules.length > 0 ? dto.rules : [
        'Tôn trọng và hỗ trợ lẫn nhau trong học tập',
        'Không spam hay đăng bài quảng cáo thương mại ngoài học thuật',
        'Chia sẻ kiến thức bổ ích và xây dựng',
      ],
      isPublic: dto.isPublic ?? true,
    });

    const saved = await group.save();
    return this.mapGroupToDto(saved, creatorId);
  }

  /** Lấy danh sách nhóm kèm bộ lọc tìm kiếm / chuyên ngành / nhóm của tôi */
  async getAllGroups(query?: {
    search?: string;
    category?: string;
    userId?: string;
    myGroupsOnly?: boolean;
  }): Promise<{ groups: CommunityGroupResponseDto[]; total: number }> {
    const filter: any = {};

    if (query?.category && query.category !== 'ALL' && query.category !== 'Tất cả') {
      filter.category = query.category;
    }

    if (query?.myGroupsOnly && query?.userId) {
      filter.memberIds = query.userId;
    }

    if (query?.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [{ name: regex }, { description: regex }, { category: regex }];
    }

    const groups = await this.groupModel.find(filter).sort({ createdAt: -1 }).exec();
    const formatted = groups.map((g) => this.mapGroupToDto(g, query?.userId));

    return {
      groups: formatted,
      total: formatted.length,
    };
  }

  /** Lấy chi tiết một nhóm theo ID */
  async getGroupById(groupId: string, currentUserId?: string): Promise<CommunityGroupResponseDto> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new BadRequestException('Invalid Group ID');
    }
    const group = await this.groupModel.findById(groupId).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return this.mapGroupToDto(group, currentUserId);
  }

  /** Tham gia nhóm */
  async joinGroup(groupId: string, userId: string): Promise<CommunityGroupResponseDto> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new BadRequestException('Invalid Group ID');
    }
    const group = await this.groupModel.findById(groupId).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!group.memberIds.includes(userId)) {
      group.memberIds.push(userId);
      group.membersCount = group.memberIds.length;
      await group.save();
    }

    return this.mapGroupToDto(group, userId);
  }

  /** Rời nhóm */
  async leaveGroup(groupId: string, userId: string): Promise<CommunityGroupResponseDto> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new BadRequestException('Invalid Group ID');
    }
    const group = await this.groupModel.findById(groupId).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    group.memberIds = group.memberIds.filter((id) => id !== userId);
    group.membersCount = group.memberIds.length;
    await group.save();

    return this.mapGroupToDto(group, userId);
  }

  // ====================================================================
  // 7. GROUP POST OPERATIONS (Bảng tin bài viết nhóm)
  // ====================================================================

  /** Đăng bài viết mới vào nhóm */
  async createGroupPost(
    groupId: string,
    authorId: string,
    dto: CreateGroupPostDto,
    userSnapshot?: { name?: string; avatar?: string; headline?: string },
  ): Promise<GroupPostResponseDto> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new BadRequestException('Invalid Group ID');
    }
    const group = await this.groupModel.findById(groupId).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Tự động thêm vào thành viên nếu chưa join
    if (!group.memberIds.includes(authorId)) {
      group.memberIds.push(authorId);
      group.membersCount = group.memberIds.length;
    }
    group.postsCount = (group.postsCount || 0) + 1;
    await group.save();

    const post = new this.groupPostModel({
      groupId: new Types.ObjectId(groupId),
      authorId,
      authorName: userSnapshot?.name || 'Thành viên',
      authorAvatar: userSnapshot?.avatar || '',
      authorHeadline: userSnapshot?.headline || 'Sinh viên UniTime',
      content: dto.content,
      images: dto.images || [],
      tag: dto.tag || 'GENERAL',
      likes: [],
      commentsCount: 0,
      isPinned: false,
    });

    const saved = await post.save();
    return this.mapGroupPostToDto(saved, authorId);
  }

  /** Lấy danh sách bài viết trong nhóm */
  async getGroupPosts(groupId: string, currentUserId?: string): Promise<GroupPostResponseDto[]> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new BadRequestException('Invalid Group ID');
    }
    const posts = await this.groupPostModel
      .find({ groupId: new Types.ObjectId(groupId) as any })
      .sort({ isPinned: -1, createdAt: -1 })
      .exec();

    return posts.map((p) => this.mapGroupPostToDto(p, currentUserId));
  }

  /** Thả tim / Bỏ tim bài viết (Like / Unlike) */
  async toggleLikeGroupPost(groupId: string, postId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid Post ID');
    }
    const post = await this.groupPostModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const hasLiked = post.likes.includes(userId);
    if (hasLiked) {
      post.likes = post.likes.filter((id) => id !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    return {
      isLiked: !hasLiked,
      likesCount: post.likes.length,
    };
  }

  /** Xóa bài viết trong nhóm */
  async deleteGroupPost(groupId: string, postId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid Post ID');
    }
    const post = await this.groupPostModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    const group = await this.groupModel.findById(groupId).exec();
    const isGroupOwner = group && group.creatorId === userId;
    const isAuthor = post.authorId === userId;

    if (!isAuthor && !isGroupOwner) {
      throw new ForbiddenException('You are not authorized to delete this post');
    }

    await this.groupPostModel.findByIdAndDelete(postId).exec();
    await this.groupCommentModel.deleteMany({ postId: new Types.ObjectId(postId) as any }).exec();
    await this.groupModel.findByIdAndUpdate(groupId, { $inc: { postsCount: -1 } }).exec();
  }

  // ====================================================================
  // 8. GROUP COMMENT OPERATIONS (Bình luận bài viết)
  // ====================================================================

  /** Viết bình luận vào bài viết nhóm (Hỗ trợ trả lời 2 cấp) */
  async createGroupComment(
    groupId: string,
    postId: string,
    authorId: string,
    dto: CreateGroupCommentDto,
    userSnapshot?: { name?: string; avatar?: string },
  ): Promise<GroupCommentResponseDto> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid Post ID');
    }
    const post = await this.groupPostModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    let finalParentId: Types.ObjectId | null = null;
    if (dto.parentId && Types.ObjectId.isValid(dto.parentId)) {
      const parentComment = await this.groupCommentModel.findById(dto.parentId).exec();
      if (parentComment) {
        // Enforce 2 levels max:
        // If parentComment is already a level-2 reply, link to its root parentId
        finalParentId = parentComment.parentId
          ? new Types.ObjectId(parentComment.parentId as string)
          : new Types.ObjectId(dto.parentId);
      }
    }

    const comment = new this.groupCommentModel({
      postId: new Types.ObjectId(postId),
      groupId: new Types.ObjectId(groupId),
      parentId: finalParentId,
      replyToUserName: dto.replyToUserName || '',
      authorId,
      authorName: userSnapshot?.name || 'Thành viên',
      authorAvatar: userSnapshot?.avatar || '',
      content: dto.content,
    });

    const saved = await comment.save();

    post.commentsCount = (post.commentsCount || 0) + 1;
    await post.save();

    return {
      _id: saved._id.toString(),
      postId: saved.postId.toString(),
      groupId: saved.groupId.toString(),
      parentId: saved.parentId ? saved.parentId.toString() : undefined,
      replyToUserName: saved.replyToUserName || undefined,
      authorId: saved.authorId,
      authorName: saved.authorName,
      authorAvatar: saved.authorAvatar,
      content: saved.content,
      createdAt: saved.createdAt ? saved.createdAt.toISOString() : new Date().toISOString(),
    };
  }

  /** Lấy danh sách bình luận của bài viết */
  async getGroupComments(postId: string): Promise<GroupCommentResponseDto[]> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid Post ID');
    }
    const comments = await this.groupCommentModel
      .find({ postId: new Types.ObjectId(postId) as any })
      .sort({ createdAt: 1 })
      .exec();

    return comments.map((c) => ({
      _id: c._id.toString(),
      postId: c.postId.toString(),
      groupId: c.groupId.toString(),
      parentId: c.parentId ? c.parentId.toString() : undefined,
      replyToUserName: c.replyToUserName || undefined,
      authorId: c.authorId,
      authorName: c.authorName,
      authorAvatar: c.authorAvatar,
      content: c.content,
      createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    }));
  }

  /** Xóa bình luận */
  async deleteGroupComment(commentId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Invalid Comment ID');
    }
    const comment = await this.groupCommentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    const group = await this.groupModel.findById(comment.groupId).exec();
    const isGroupOwner = group && group.creatorId === userId;
    const isAuthor = comment.authorId === userId;

    if (!isAuthor && !isGroupOwner) {
      throw new ForbiddenException('Not authorized to delete this comment');
    }

    // Cascade delete child replies under this comment if it's a parent
    const replies = await this.groupCommentModel
      .find({ parentId: new Types.ObjectId(commentId) as any })
      .exec();
    const totalDeleted = 1 + replies.length;

    await this.groupCommentModel
      .deleteMany({
        $or: [
          { _id: new Types.ObjectId(commentId) },
          { parentId: new Types.ObjectId(commentId) },
        ],
      })
      .exec();

    await this.groupPostModel
      .findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -totalDeleted } })
      .exec();
  }

  // ====================================================================
  // COMMUNITY MAPPERS
  // ====================================================================

  private mapGroupToDto(doc: any, currentUserId?: string): CommunityGroupResponseDto {
    const memberIds = doc.memberIds || [];
    return {
      _id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      coverImage: doc.coverImage,
      avatarUrl: doc.avatarUrl,
      category: doc.category,
      creatorId: doc.creatorId,
      creatorName: doc.creatorName,
      creatorAvatar: doc.creatorAvatar,
      membersCount: doc.membersCount ?? memberIds.length,
      postsCount: doc.postsCount ?? 0,
      rules: doc.rules || [],
      isJoined: currentUserId ? memberIds.includes(currentUserId) : false,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  private mapGroupPostToDto(doc: any, currentUserId?: string): GroupPostResponseDto {
    const likes = doc.likes || [];
    return {
      _id: doc._id.toString(),
      groupId: doc.groupId.toString(),
      authorId: doc.authorId,
      authorName: doc.authorName,
      authorAvatar: doc.authorAvatar,
      authorHeadline: doc.authorHeadline,
      content: doc.content,
      images: doc.images || [],
      tag: doc.tag || 'GENERAL',
      likesCount: likes.length,
      isLiked: currentUserId ? likes.includes(currentUserId) : false,
      commentsCount: doc.commentsCount ?? 0,
      isPinned: doc.isPinned ?? false,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
