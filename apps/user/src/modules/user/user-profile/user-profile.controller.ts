import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UpdateProfileDto, GetUserProfileResponseDto, GetPublicProfileResponseDto } from '@app/contracts/user';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';

@Controller('users')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

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
