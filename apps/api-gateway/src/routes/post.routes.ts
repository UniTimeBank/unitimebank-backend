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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PostClient } from '../clients/post.client';
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

// ====================================================================
// 1. MENTOR POST ROUTES
// ====================================================================

@ApiTags('Post - Bài đăng của Người dạy (Mentor)')
@Controller('posts/mentor')
export class PostMentorRoutes {
  constructor(private readonly postClient: PostClient) {}

  /** Mentor tạo bài đăng nhận dạy mới */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mentor tạo bài đăng nhận dạy mới' })
  @ApiBody({ type: CreateMentorPostDto })
  @ApiResponse({ status: 201, description: 'Tạo bài đăng thành công', type: MentorPostResponseDto })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async createMentorPost(@Body() dto: CreateMentorPostDto, @Req() req: any) {
    const mentorId = req.user?.id || req.headers['x-user-id'] || 'default-user';
    const userSnapshot = {
      name: req.user?.displayName,
      avatar: req.user?.avatarUrl,
      trustScore: req.user?.trustScore,
    };
    return this.postClient.createMentorPost(mentorId, dto, userSnapshot);
  }

  /** Lấy danh sách bài đăng của chính Mentor */
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách bài đăng của chính tôi (Mentor)' })
  @ApiResponse({ status: 200, description: 'Danh sách bài đăng của tôi', type: GetMentorPostsResponseDto })
  async getMyMentorPosts(@Query() query: GetMentorPostsQueryDto, @Req() req: any) {
    const mentorId = req.user?.id || req.headers['x-user-id'] || 'default-user';
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
    const mentorId = req.user?.id || req.headers['x-user-id'] || 'default-user';
    return this.postClient.updateMentorPost(id, mentorId, dto);
  }

  /** Đóng bài dạy (ngừng nhận học viên) */
  @Post(':id/close')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đóng bài dạy (ngừng nhận học viên)' })
  @ApiResponse({ status: 200, description: 'Đã đóng bài dạy thành công', type: MentorPostResponseDto })
  async closeMentorPost(@Param('id') id: string, @Req() req: any) {
    const mentorId = req.user?.id || req.headers['x-user-id'] || 'default-user';
    return this.postClient.closeMentorPost(id, mentorId);
  }

  /** Xóa mềm bài đăng của Mentor */
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa mềm bài dạy của Mentor' })
  @ApiResponse({ status: 200, description: 'Đã xóa bài dạy thành công', type: MentorPostResponseDto })
  async deleteMentorPost(@Param('id') id: string, @Req() req: any) {
    const mentorId = req.user?.id || req.headers['x-user-id'] || 'default-user';
    return this.postClient.deleteMentorPost(id, mentorId);
  }
}

// ====================================================================
// 2. LEARNER REQUEST ROUTES
// ====================================================================

@ApiTags('Post - Yêu cầu tìm Người dạy (Learner Request)')
@Controller('posts/learner')
export class PostLearnerRoutes {
  constructor(private readonly postClient: PostClient) {}

  /** Learner tạo bài tìm người dạy */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo bài tìm người dạy (tự động tính 1 phút = 1 Credit)' })
  @ApiBody({ type: CreateLearnerRequestDto })
  @ApiResponse({ status: 201, description: 'Tạo yêu cầu thành công', type: LearnerRequestResponseDto })
  async createLearnerRequest(@Body() dto: CreateLearnerRequestDto, @Req() req: any) {
    const learnerId = req.user?.id || req.headers['x-user-id'] || 'default-user';
    const userSnapshot = {
      name: req.user?.displayName,
      avatar: req.user?.avatarUrl,
    };
    return this.postClient.createLearnerRequest(learnerId, dto, userSnapshot);
  }

  /** Lấy danh sách yêu cầu của chính tôi */
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách bài tìm người dạy của chính tôi' })
  @ApiResponse({ status: 200, description: 'Danh sách yêu cầu của tôi', type: GetLearnerRequestsResponseDto })
  async getMyLearnerRequests(@Query() query: GetLearnerRequestsQueryDto, @Req() req: any) {
    const learnerId = req.user?.id || req.headers['x-user-id'] || 'default-user';
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật bài tìm người dạy' })
  @ApiBody({ type: UpdateLearnerRequestDto })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: LearnerRequestResponseDto })
  async updateLearnerRequest(
    @Param('id') id: string,
    @Body() dto: UpdateLearnerRequestDto,
    @Req() req: any,
  ) {
    const learnerId = req.user?.id || req.headers['x-user-id'] || 'default-user';
    return this.postClient.updateLearnerRequest(id, learnerId, dto);
  }

  /** Hủy yêu cầu */
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy bài tìm người dạy' })
  @ApiResponse({ status: 200, description: 'Hủy thành công', type: LearnerRequestResponseDto })
  async cancelLearnerRequest(@Param('id') id: string, @Req() req: any) {
    const learnerId = req.user?.id || req.headers['x-user-id'] || 'default-user';
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
