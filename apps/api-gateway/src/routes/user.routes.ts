import { Controller, Get, Patch, Post, Delete, Body, Param, Query, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserClient } from '../clients/user.client';
import {
  UpdateProfileDto,
  GetUserProfileResponseDto,
  GetPublicProfileResponseDto,
  CreateSkillDto,
  UpdateSkillDto,
  SkillDto,
  GetMySkillsResponseDto,
  GetSkillCategoriesResponseDto,
  UploadAvatarResponseDto,
  FollowUserResponseDto,
  GetFollowersResponseDto,
  GetFollowingResponseDto,
  CheckInResponseDto,
  GetCheckInStatusResponseDto,
  CreateRecurringScheduleDto,
  UpdateRecurringScheduleDto,
  CreateScheduleExceptionDto,
  GetRecurringSchedulesResponseDto,
  RecurringScheduleResponseDto,
  GetScheduleExceptionsResponseDto,
  ScheduleExceptionResponseDto,
  GetAvailabilityResponseDto,
} from '@app/contracts/user';

// ============================================
// User Profile Routes
// ============================================
@ApiTags('User - Người dùng')
@Controller('users')
export class UserRoutes {
  constructor(private readonly userClient: UserClient) {}

  /** Lấy thông tin profile của user hiện tại */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin profile của user hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin profile',
    type: GetUserProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async getMyProfile(@Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.getMyProfile(headers);
  }

  /** Cập nhật profile của user hiện tại */
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thành công',
    type: GetUserProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async updateProfile(@Body() dto: UpdateProfileDto, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.updateProfile(dto, headers);
  }

  /** Lấy danh sách kỹ năng của user hiện tại */
  @Get('me/skills')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách kỹ năng của tôi' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách kỹ năng',
    type: GetMySkillsResponseDto,
  })
  async getMySkillsRoute(@Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.getMySkills(headers);
  }

  /** Lấy thông tin profile công khai của một user */
  @Get(':userId')
  @ApiOperation({ summary: 'Lấy thông tin profile công khai' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin profile công khai',
    type: GetPublicProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async getPublicProfile(@Param('userId') userId: string, @Req() req: any) {
    if (userId === 'me') {
      const headers = { Authorization: req.headers.authorization };
      return this.userClient.getMyProfile(headers);
    }
    return this.userClient.getPublicProfile(userId);
  }

  /** Lấy danh sách kỹ năng công khai của một user */
  @Get(':userId/skills')
  @ApiOperation({ summary: 'Lấy danh sách kỹ năng công khai của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách kỹ năng công khai',
    type: GetMySkillsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async getSkillsByUserId(@Param('userId') userId: string, @Req() req: any) {
    if (userId === 'me') {
      const headers = { Authorization: req.headers.authorization };
      return this.userClient.getMySkills(headers);
    }
    return this.userClient.getSkillsByUserId(userId);
  }
}

// ============================================
// User Avatar Routes
// ============================================
@ApiTags('User - Avatar')
@Controller('users/me/avatar')
@ApiBearerAuth()
export class UserAvatarRoutes {
  constructor(private readonly userClient: UserClient) {}

  @Post()
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({ summary: 'Upload ảnh đại diện cá nhân lên Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh đại diện (JPG, PNG, WEBP, <= 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload thành công',
    type: UploadAvatarResponseDto,
  })
  async uploadAvatar(
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.uploadAvatar(file, headers);
  }
}

// ============================================
// User Daily Check-in Streak Routes
// ============================================
@ApiTags('User - Daily Check-in Streak')
@Controller('users/me/check-in')
@ApiBearerAuth()
export class UserCheckinRoutes {
  constructor(private readonly userClient: UserClient) {}

  /** Thực hiện điểm danh hàng ngày */
  @Post()
  @ApiOperation({ summary: 'Điểm danh hàng ngày' })
  @ApiResponse({
    status: 201,
    description: 'Điểm danh thành công',
    type: CheckInResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Bạn đã điểm danh ngày hôm nay rồi' })
  async checkIn(@Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.checkIn(headers);
  }

  /** Lấy trạng thái điểm danh hiện tại */
  @Get()
  @ApiOperation({ summary: 'Lấy trạng thái điểm danh và chuỗi Streak hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái điểm danh',
    type: GetCheckInStatusResponseDto,
  })
  async getCheckInStatus(@Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.getCheckInStatus(headers);
  }
}

// ============================================
// User Follow Routes
// ============================================
@ApiTags('User - Follow System')
@Controller('users')
export class UserFollowRoutes {
  constructor(private readonly userClient: UserClient) {}

  /** Theo dõi một người dùng */
  @Post(':userId/follow')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Theo dõi một người dùng' })
  @ApiResponse({
    status: 201,
    description: 'Theo dõi thành công',
    type: FollowUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Không thể tự theo dõi chính mình' })
  @ApiResponse({ status: 409, description: 'Đã theo dõi người dùng này rồi' })
  async followUser(@Param('userId') targetUserId: string, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.followUser(targetUserId, headers);
  }

  /** Bỏ theo dõi một người dùng */
  @Delete(':userId/follow')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bỏ theo dõi một người dùng' })
  @ApiResponse({ status: 200, description: 'Bỏ theo dõi thành công' })
  @ApiResponse({ status: 404, description: 'Chưa theo dõi người dùng này' })
  async unfollowUser(@Param('userId') targetUserId: string, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.unfollowUser(targetUserId, headers);
  }

  /** Lấy danh sách người theo dõi của một user */
  @Get(':userId/followers')
  @ApiOperation({ summary: 'Lấy danh sách những người theo dõi người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách người theo dõi',
    type: GetFollowersResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async getFollowers(@Param('userId') targetUserId: string) {
    return this.userClient.getFollowers(targetUserId);
  }

  /** Lấy danh sách những người mà user đang theo dõi */
  @Get(':userId/following')
  @ApiOperation({ summary: 'Lấy danh sách những người mà người dùng đang theo dõi' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách người đang theo dõi',
    type: GetFollowingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async getFollowing(@Param('userId') targetUserId: string) {
    return this.userClient.getFollowing(targetUserId);
  }
}

// ============================================
// User Skills Routes
// ============================================
@ApiTags('User - Kỹ năng')
@Controller('users/me/skills')
@ApiBearerAuth()
export class UserSkillRoutes {
  constructor(private readonly userClient: UserClient) {}

  /** Lấy danh sách kỹ năng của user hiện tại */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách kỹ năng của tôi' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách kỹ năng',
    type: GetMySkillsResponseDto,
  })
  async getMySkills(@Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.getMySkills(headers);
  }

  /** Thêm kỹ năng mới */
  @Post()
  @ApiOperation({ summary: 'Thêm kỹ năng mới' })
  @ApiBody({ type: CreateSkillDto })
  @ApiResponse({
    status: 201,
    description: 'Thêm kỹ năng thành công',
    type: SkillDto,
  })
  @ApiResponse({ status: 409, description: 'Kỹ năng đã tồn tại' })
  async createSkill(@Body() dto: CreateSkillDto, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.createSkill(dto, headers);
  }

  /** Cập nhật kỹ năng */
  @Patch(':skillId')
  @ApiOperation({ summary: 'Cập nhật kỹ năng (tên, danh mục, kỹ năng thế mạnh)' })
  @ApiBody({ type: UpdateSkillDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật kỹ năng thành công',
    type: SkillDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy kỹ năng' })
  @ApiResponse({ status: 409, description: 'Tên kỹ năng bị trùng' })
  async updateSkill(
    @Param('skillId') skillId: string,
    @Body() dto: UpdateSkillDto,
    @Req() req: any,
  ) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.updateSkill(skillId, dto, headers);
  }

  /** Xóa kỹ năng */
  @Delete(':skillId')
  @ApiOperation({ summary: 'Xóa kỹ năng' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy kỹ năng' })
  async deleteSkill(@Param('skillId') skillId: string, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.deleteSkill(skillId, headers);
  }
}

// ============================================
// Skill Categories Routes
// ============================================
@ApiTags('User - Danh mục kỹ năng')
@Controller('skills/categories')
export class SkillCategoryRoutes {
  constructor(private readonly userClient: UserClient) {}

  /** Lấy danh sách danh mục kỹ năng */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách danh mục kỹ năng' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách danh mục',
    type: GetSkillCategoriesResponseDto,
  })
  async getCategories() {
    return this.userClient.getSkillCategories();
  }
}

// ============================================
// User Schedule & Availability Routes
// ============================================
@ApiTags('User - Quản lý lịch rảnh (Schedule)')
@Controller('users')
export class UserScheduleRoutes {
  constructor(private readonly userClient: UserClient) {}

  /** Lấy danh sách lịch rảnh lặp lại hàng tuần của tôi */
  @Get('me/schedule/recurring')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lịch rảnh lặp lại hàng tuần của tôi' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lịch rảnh lặp lại',
    type: GetRecurringSchedulesResponseDto,
  })
  async getMyRecurringSchedules(@Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.getMyRecurringSchedules(headers);
  }

  /** Tạo lịch rảnh lặp lại hàng tuần mới */
  @Post('me/schedule/recurring')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo lịch rảnh lặp lại hàng tuần mới cho Người dạy' })
  @ApiBody({ type: CreateRecurringScheduleDto })
  @ApiResponse({
    status: 201,
    description: 'Tạo lịch lặp lại thành công',
    type: RecurringScheduleResponseDto,
  })
  async createRecurringSchedule(@Body() dto: CreateRecurringScheduleDto, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.createRecurringSchedule(dto, headers);
  }

  /** Cập nhật lịch rảnh lặp lại */
  @Patch('me/schedule/recurring/:scheduleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật lịch rảnh lặp lại' })
  @ApiBody({ type: UpdateRecurringScheduleDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật lịch thành công',
    type: RecurringScheduleResponseDto,
  })
  async updateRecurringSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateRecurringScheduleDto,
    @Req() req: any,
  ) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.updateRecurringSchedule(scheduleId, dto, headers);
  }

  /** Xóa lịch rảnh lặp lại */
  @Delete('me/schedule/recurring/:scheduleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa lịch rảnh lặp lại' })
  @ApiResponse({ status: 204, description: 'Xóa thành công' })
  async deleteRecurringSchedule(@Param('scheduleId') scheduleId: string, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.deleteRecurringSchedule(scheduleId, headers);
  }

  /** Lấy danh sách lịch đặc biệt (EXTRA / BLOCKED) */
  @Get('me/schedule/exceptions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lịch đặc biệt (EXTRA / BLOCKED) của tôi' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lịch đặc biệt',
    type: GetScheduleExceptionsResponseDto,
  })
  async getMyScheduleExceptions(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.getMyScheduleExceptions(from, to, headers);
  }

  /** Tạo lịch đặc biệt (thêm giờ EXTRA hoặc chặn giờ BLOCKED) */
  @Post('me/schedule/exceptions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo lịch đặc biệt (thêm giờ EXTRA hoặc chặn giờ BLOCKED)' })
  @ApiBody({ type: CreateScheduleExceptionDto })
  @ApiResponse({
    status: 201,
    description: 'Tạo lịch đặc biệt thành công',
    type: ScheduleExceptionResponseDto,
  })
  async createScheduleException(@Body() dto: CreateScheduleExceptionDto, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.createScheduleException(dto, headers);
  }

  /** Xóa lịch đặc biệt */
  @Delete('me/schedule/exceptions/:exceptionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa lịch đặc biệt' })
  @ApiResponse({ status: 204, description: 'Xóa thành công' })
  async deleteScheduleException(@Param('exceptionId') exceptionId: string, @Req() req: any) {
    const headers = { Authorization: req.headers.authorization };
    return this.userClient.deleteScheduleException(exceptionId, headers);
  }

  /** Lấy lịch rảnh khả dụng của Người dạy trong khoảng ngày */
  @Get(':userId/schedule/availability')
  @ApiOperation({ summary: 'Lấy lịch rảnh khả dụng của Người dạy trong khoảng ngày (from -> to)' })
  @ApiResponse({
    status: 200,
    description: 'Lịch rảnh khả dụng theo từng ngày',
    type: GetAvailabilityResponseDto,
  })
  async getAvailability(
    @Param('userId') targetUserId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.userClient.getAvailability(targetUserId, from, to);
  }
}
