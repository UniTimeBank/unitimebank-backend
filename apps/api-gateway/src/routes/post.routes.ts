import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/common';
import { PostClient } from '../clients/post.client';
import { UserClient } from '../clients/user.client';
import { SessionClient } from '../clients/session.client';
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
  CreateCommunityGroupDto,
  CreateGroupPostDto,
  CreateGroupCommentDto,
} from '@app/contracts/post';

// ====================================================================
// 1. MENTOR POST ROUTES
// ====================================================================

@ApiTags('Post - Bài đăng của Người dạy (Mentor)')
@Controller('posts/mentor')
export class PostMentorRoutes {
  constructor(
    private readonly postClient: PostClient,
    private readonly userClient: UserClient,
    private readonly sessionClient: SessionClient,
  ) {}

  /** Mentor tạo bài đăng nhận dạy mới */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor tạo bài đăng nhận dạy mới' })
  @ApiBody({ type: CreateMentorPostDto })
  @ApiResponse({ status: 201, description: 'Tạo bài đăng thành công', type: MentorPostResponseDto })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async createMentorPost(@Body() dto: CreateMentorPostDto, @Req() req: any) {
    const mentorId = req.user?.id || req.user?.sub;

    const inActiveGroup = await this.sessionClient.send('session.checkUserInActiveGroupRoom', { userId: mentorId });
    if (inActiveGroup) {
      throw new BadRequestException('Bạn đang tham gia phòng học nhóm trực tuyến. Vui lòng rời phòng học trước khi tạo bài đăng mới.');
    }

    let userSnapshot: any = undefined;
    if (req.headers.authorization) {
      try {
        const profile = await this.userClient.getMyProfile({ Authorization: req.headers.authorization });
        userSnapshot = {
          name: profile?.displayName || profile?.fullName || 'Mentor',
          avatar: profile?.avatarUrl || '',
          trustScore: profile?.trustScore ?? 100,
        };
      } catch {
        userSnapshot = {
          name: req.user?.displayName || req.user?.email || 'Mentor',
          avatar: req.user?.avatarUrl || '',
          trustScore: req.user?.trustScore ?? 100,
        };
      }
    }
    return this.postClient.createMentorPost(mentorId, dto, userSnapshot);
  }

  /** Lấy danh sách bài đăng của chính Mentor */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách bài đăng của chính tôi (Mentor)' })
  @ApiResponse({ status: 200, description: 'Danh sách bài đăng của tôi', type: GetMentorPostsResponseDto })
  async getMyMentorPosts(@Query() query: GetMentorPostsQueryDto, @Req() req: any) {
    const mentorId = req.user?.id || req.user?.sub;
    return this.postClient.getMyMentorPosts(mentorId, query);
  }

  /** Lấy danh sách bài dạy công khai có bộ lọc đa chiều */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bài dạy công khai (kèm filter theo skill, category, sessionType, trustScoreMin, dayOfWeek)' })
  @ApiResponse({ status: 200, description: 'Danh sách bài dạy', type: GetMentorPostsResponseDto })
  async getMentorPosts(@Query() query: GetMentorPostsQueryDto) {
    return this.postClient.getMentorPosts(query);
  }

  /** Lấy chi tiết bài dạy */
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một bài dạy' })
  @ApiResponse({ status: 200, description: 'Chi tiết bài dạy', type: MentorPostResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bài đăng' })
  async getMentorPostById(@Param('id') id: string) {
    return this.postClient.getMentorPostById(id);
  }

  /** Cập nhật nội dung bài dạy */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật bài dạy của Mentor' })
  @ApiBody({ type: UpdateMentorPostDto })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: MentorPostResponseDto })
  @ApiResponse({ status: 403, description: 'Không có quyền chỉnh sửa bài đăng này' })
  async updateMentorPost(
    @Param('id') id: string,
    @Body() dto: UpdateMentorPostDto,
    @Req() req: any,
  ) {
    const mentorId = req.user?.id || req.user?.sub;
    return this.postClient.updateMentorPost(id, mentorId, dto);
  }

  /** Đóng bài dạy (ngừng nhận học viên) */
  @Post(':id/close')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đóng bài dạy (ngừng nhận học viên)' })
  @ApiResponse({ status: 200, description: 'Đã đóng bài dạy thành công', type: MentorPostResponseDto })
  async closeMentorPost(@Param('id') id: string, @Req() req: any) {
    const mentorId = req.user?.id || req.user?.sub;
    return this.postClient.closeMentorPost(id, mentorId);
  }

  /** Xóa mềm bài đăng của Mentor */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa mềm bài dạy của Mentor' })
  @ApiResponse({ status: 200, description: 'Đã xóa bài dạy thành công', type: MentorPostResponseDto })
  async deleteMentorPost(@Param('id') id: string, @Req() req: any) {
    const mentorId = req.user?.id || req.user?.sub;
    return this.postClient.deleteMentorPost(id, mentorId);
  }
}

// ====================================================================
// 2. LEARNER REQUEST ROUTES
// ====================================================================

@ApiTags('Post - Yêu cầu tìm Người dạy (Learner Request)')
@Controller('posts/learner')
export class PostLearnerRoutes {
  constructor(
    private readonly postClient: PostClient,
    private readonly userClient: UserClient,
    private readonly sessionClient: SessionClient,
  ) {}

  /** Learner tạo bài tìm người dạy */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo bài tìm người dạy (tự động tính 1 phút = 1 Credit)' })
  @ApiBody({ type: CreateLearnerRequestDto })
  @ApiResponse({ status: 201, description: 'Tạo yêu cầu thành công', type: LearnerRequestResponseDto })
  async createLearnerRequest(@Body() dto: CreateLearnerRequestDto, @Req() req: any) {
    const learnerId = req.user?.id || req.user?.sub;

    const inActiveGroup = await this.sessionClient.send('session.checkUserInActiveGroupRoom', { userId: learnerId });
    if (inActiveGroup) {
      throw new BadRequestException('Bạn đang tham gia phòng học nhóm trực tuyến. Vui lòng rời phòng học trước khi tạo yêu cầu học tập mới.');
    }

    let userSnapshot: any = undefined;
    if (req.headers.authorization) {
      try {
        const profile = await this.userClient.getMyProfile({ Authorization: req.headers.authorization });
        userSnapshot = {
          name: profile?.displayName || profile?.fullName || 'Learner',
          avatar: profile?.avatarUrl || '',
        };
      } catch {
        userSnapshot = {
          name: req.user?.displayName || req.user?.email || 'Learner',
          avatar: req.user?.avatarUrl || '',
        };
      }
    }
    return this.postClient.createLearnerRequest(learnerId, dto, userSnapshot);
  }

  /** Lấy danh sách yêu cầu của chính tôi */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách bài tìm người dạy của chính tôi' })
  @ApiResponse({ status: 200, description: 'Danh sách yêu cầu của tôi', type: GetLearnerRequestsResponseDto })
  async getMyLearnerRequests(@Query() query: GetLearnerRequestsQueryDto, @Req() req: any) {
    const learnerId = req.user?.id || req.user?.sub;
    return this.postClient.getMyLearnerRequests(learnerId, query);
  }

  /** Lấy danh sách bài tìm người dạy công khai */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bài tìm người dạy công khai (kèm filter)' })
  @ApiResponse({ status: 200, description: 'Danh sách yêu cầu', type: GetLearnerRequestsResponseDto })
  async getLearnerRequests(@Query() query: GetLearnerRequestsQueryDto) {
    return this.postClient.getLearnerRequests(query);
  }

  /** Lấy chi tiết bài yêu cầu */
  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một yêu cầu tìm người dạy' })
  @ApiResponse({ status: 200, description: 'Chi tiết yêu cầu', type: LearnerRequestResponseDto })
  async getLearnerRequestById(@Param('id') id: string) {
    return this.postClient.getLearnerRequestById(id);
  }

  /** Cập nhật yêu cầu */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật bài tìm người dạy' })
  @ApiBody({ type: UpdateLearnerRequestDto })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: LearnerRequestResponseDto })
  async updateLearnerRequest(
    @Param('id') id: string,
    @Body() dto: UpdateLearnerRequestDto,
    @Req() req: any,
  ) {
    const learnerId = req.user?.id || req.user?.sub;
    return this.postClient.updateLearnerRequest(id, learnerId, dto);
  }

  /** Hủy yêu cầu */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy bài tìm người dạy' })
  @ApiResponse({ status: 200, description: 'Hủy thành công', type: LearnerRequestResponseDto })
  async cancelLearnerRequest(@Param('id') id: string, @Req() req: any) {
    const learnerId = req.user?.id || req.user?.sub;
    return this.postClient.cancelLearnerRequest(id, learnerId);
  }
}

// ====================================================================
// 3. SEARCH & RECOMMENDATIONS ROUTES
// ====================================================================

@ApiTags('Post - Tìm kiếm & Gợi ý')
@Controller('posts')
export class PostSearchRoutes {
  constructor(private readonly postClient: PostClient) {}

  /** Gợi ý từ khóa tức thì khi người dùng gõ vào SearchBar */
  @Get('suggestions')
  @ApiOperation({ summary: 'Lấy gợi ý từ khóa tức thì (Live Suggestions) khi gõ tìm kiếm' })
  @ApiQuery({ name: 'q', required: true, example: 'Spring' })
  @ApiResponse({ status: 200, description: 'Danh sách gợi ý kỹ năng, tiêu đề, danh mục', type: PostSuggestionsResponseDto })
  async getSuggestions(@Query('q') q: string) {
    return this.postClient.getSuggestions(q || '');
  }

  /** Tìm kiếm đa chiều kết hợp Mentor Post & Learner Request */
  @Get('search')
  @ApiOperation({ summary: 'Tìm kiếm đa chiều kết hợp bài Mentor & Learner' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm', type: SearchPostsResponseDto })
  async searchCombined(@Query() query: SearchPostsQueryDto) {
    return this.postClient.searchCombined(query);
  }

  /** Lấy danh sách bài đăng gợi ý cá nhân hóa */
  @Get('recommendations')
  @ApiOperation({ summary: 'Lấy danh sách bài đăng gợi ý cá nhân hóa' })
  @ApiResponse({ status: 200, description: 'Danh sách bài đăng gợi ý', type: PostRecommendationsResponseDto })
  async getRecommendations(@Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];
    const skills = req.user?.skills?.map((s: any) => s.skillName) || [];
    return this.postClient.getRecommendations(userId, skills);
  }
}

// ====================================================================
// 4. COMMUNITY GROUP ROUTES (Facebook Groups Model)
// ====================================================================

@ApiTags('Community - Nhóm học tập & Bảng tin')
@Controller('groups')
export class CommunityGroupRoutes {
  constructor(
    private readonly postClient: PostClient,
    private readonly userClient: UserClient,
  ) {}

  private extractUserIdFromReq(req: any): string | undefined {
    let userId = req?.user?.id || req?.user?.sub || req?.headers?.['x-user-id'];
    if (!userId && req?.headers?.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          userId = payload?.id || payload?.sub || payload?.userId;
        }
      } catch {}
    }
    return userId;
  }

  /** Lấy danh sách nhóm cộng đồng */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhóm học tập (kèm bộ lọc tìm kiếm & chuyên ngành)' })
  async getAllGroups(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('myGroupsOnly') myGroupsOnly?: boolean,
    @Req() req?: any,
  ) {
    const userId = this.extractUserIdFromReq(req);
    return this.postClient.getAllGroups({
      search,
      category,
      userId,
      myGroupsOnly: String(myGroupsOnly) === 'true',
    });
  }

  /** Tạo nhóm cộng đồng mới */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo nhóm học tập mới' })
  async createGroup(@Body() dto: CreateCommunityGroupDto, @Req() req: any) {
    const creatorId = req.user?.id || req.user?.sub;
    let userSnapshot: any;
    if (req.headers?.authorization) {
      try {
        const profile = await this.userClient.getMyProfile({ Authorization: req.headers.authorization });
        userSnapshot = {
          name: profile?.displayName || profile?.fullName || req.user?.displayName || 'Thành viên',
          avatar: profile?.avatarUrl || req.user?.avatarUrl || '',
        };
      } catch {
        userSnapshot = {
          name: req.user?.displayName || 'Thành viên',
          avatar: req.user?.avatarUrl || '',
        };
      }
    } else {
      userSnapshot = {
        name: req.user?.displayName || 'Thành viên',
        avatar: req.user?.avatarUrl || '',
      };
    }
    return this.postClient.createGroup(creatorId, dto, userSnapshot);
  }

  /** Lấy chi tiết nhóm theo ID */
  @Get(':groupId')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một nhóm' })
  async getGroupById(@Param('groupId') groupId: string, @Req() req: any) {
    const currentUserId = this.extractUserIdFromReq(req);
    return this.postClient.getGroupById(groupId, currentUserId);
  }

  /** Tham gia nhóm */
  @Post(':groupId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tham gia vào nhóm học tập' })
  async joinGroup(@Param('groupId') groupId: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.postClient.joinGroup(groupId, userId);
  }

  /** Rời nhóm */
  @Post(':groupId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rời khỏi nhóm học tập' })
  async leaveGroup(@Param('groupId') groupId: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.postClient.leaveGroup(groupId, userId);
  }

  /** Lấy danh sách bài viết trong nhóm */
  @Get(':groupId/posts')
  @ApiOperation({ summary: 'Lấy bảng tin bài viết của nhóm' })
  async getGroupPosts(@Param('groupId') groupId: string, @Req() req: any) {
    const currentUserId = this.extractUserIdFromReq(req);
    return this.postClient.getGroupPosts(groupId, currentUserId);
  }

  /** Đăng bài viết mới vào nhóm */
  @Post(':groupId/posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng bài viết mới vào nhóm' })
  async createGroupPost(
    @Param('groupId') groupId: string,
    @Body() dto: CreateGroupPostDto,
    @Req() req: any,
  ) {
    const authorId = req.user?.id || req.user?.sub;
    let userSnapshot: any;
    if (req.headers?.authorization) {
      try {
        const profile = await this.userClient.getMyProfile({ Authorization: req.headers.authorization });
        userSnapshot = {
          name: profile?.displayName || profile?.fullName || req.user?.displayName || 'Thành viên',
          avatar: profile?.avatarUrl || req.user?.avatarUrl || '',
          headline: profile?.bio || profile?.headline || 'Sinh viên UniTime',
        };
      } catch {
        userSnapshot = {
          name: req.user?.displayName || 'Thành viên',
          avatar: req.user?.avatarUrl || '',
          headline: 'Sinh viên UniTime',
        };
      }
    } else {
      userSnapshot = {
        name: req.user?.displayName || 'Thành viên',
        avatar: req.user?.avatarUrl || '',
        headline: 'Sinh viên UniTime',
      };
    }
    return this.postClient.createGroupPost(groupId, authorId, dto, userSnapshot);
  }

  /** Thích / Bỏ thích bài viết trong nhóm */
  @Post(':groupId/posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thả tim / Bỏ tim bài viết trong nhóm' })
  async toggleLikeGroupPost(
    @Param('groupId') groupId: string,
    @Param('postId') postId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.postClient.toggleLikeGroupPost(groupId, postId, userId);
  }

  /** Xóa bài viết trong nhóm */
  @Delete(':groupId/posts/:postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa bài viết của chính mình trong nhóm' })
  async deleteGroupPost(
    @Param('groupId') groupId: string,
    @Param('postId') postId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.postClient.deleteGroupPost(groupId, postId, userId);
  }

  /** Lấy danh sách bình luận của bài viết */
  @Get(':groupId/posts/:postId/comments')
  @ApiOperation({ summary: 'Lấy danh sách bình luận của bài viết' })
  async getGroupComments(@Param('postId') postId: string) {
    return this.postClient.getGroupComments(postId);
  }

  /** Viết bình luận vào bài viết */
  @Post(':groupId/posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Viết bình luận vào bài viết' })
  async createGroupComment(
    @Param('groupId') groupId: string,
    @Param('postId') postId: string,
    @Body() dto: CreateGroupCommentDto,
    @Req() req: any,
  ) {
    const authorId = req.user?.id || req.user?.sub;
    let userSnapshot: any;
    if (req.headers?.authorization) {
      try {
        const profile = await this.userClient.getMyProfile({ Authorization: req.headers.authorization });
        userSnapshot = {
          name: profile?.displayName || profile?.fullName || req.user?.displayName || 'Thành viên',
          avatar: profile?.avatarUrl || req.user?.avatarUrl || '',
        };
      } catch {
        userSnapshot = {
          name: req.user?.displayName || 'Thành viên',
          avatar: req.user?.avatarUrl || '',
        };
      }
    } else {
      userSnapshot = {
        name: req.user?.displayName || 'Thành viên',
        avatar: req.user?.avatarUrl || '',
      };
    }
    return this.postClient.createGroupComment(groupId, postId, authorId, dto, userSnapshot);
  }

  /** Xóa bình luận */
  @Delete(':groupId/posts/:postId/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa bình luận của chính mình' })
  async deleteGroupComment(
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.postClient.deleteGroupComment(commentId, userId);
  }
}
