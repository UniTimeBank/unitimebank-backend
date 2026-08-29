import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import {
  UpdateProfileDto,
  GetUserProfileResponseDto,
  GetPublicProfileResponseDto,
  GetOnboardingTasksResponseDto,
} from '@app/contracts/user';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';

@Controller('users')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  /**
   * GET /users
   * Lấy danh sách toàn bộ người dùng kèm phân trang, tìm kiếm, lọc theo tier
   */
  @Get()
  async getAllUsers(
    @Query('search') search?: string,
    @Query('tier') tier?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.userProfileService.getAllUsers({
      search,
      tier,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  /**
   * GET /users/me
   * Lấy thông tin profile của user hiện tại
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req): Promise<GetUserProfileResponseDto> {
    return this.userProfileService.getMyProfile(req.user.id);
  }

  /**
   * GET /users/me/tasks
   * Lấy danh sách tiến độ 4 nhiệm vụ nhận Credit
   */
  @Get('me/tasks')
  @UseGuards(JwtAuthGuard)
  async getOnboardingTasks(@Request() req): Promise<GetOnboardingTasksResponseDto> {
    return this.userProfileService.getOnboardingTasks(req.user.id);
  }

  /**
   * PATCH /users/me
   * Cập nhật profile của user hiện tại
   */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req,
    @Body() dto: UpdateProfileDto,
  ): Promise<GetUserProfileResponseDto> {
    return this.userProfileService.updateProfile(req.user.id, dto);
  }

  /**
   * GET /users/:userId
   * Lấy thông tin công khai của một user
   */
  @Get(':userId')
  async getPublicProfile(
    @Param('userId') targetUserId: string,
  ): Promise<GetPublicProfileResponseDto> {
    return this.userProfileService.getPublicProfile(targetUserId);
  }
}
