import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserFollowService } from './user-follow.service';
import {
  FollowUserResponseDto,
  GetFollowersResponseDto,
  GetFollowingResponseDto,
} from '@app/contracts/user';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';

@ApiTags('User - Follow System')
@Controller('users')
export class UserFollowController {
  constructor(private readonly userFollowService: UserFollowService) {}

  /** Theo dõi một người dùng */
  @Post(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Theo dõi một người dùng' })
  @ApiResponse({
    status: 201,
    description: 'Theo dõi thành công',
    type: FollowUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Không thể tự theo dõi chính mình' })
  @ApiResponse({ status: 409, description: 'Đã theo dõi người dùng này rồi' })
  async followUser(
    @Req() req: any,
    @Param('userId') targetUserId: string,
  ): Promise<FollowUserResponseDto> {
    return this.userFollowService.followUser(req.user.id, targetUserId);
  }

  /** Bỏ theo dõi một người dùng */
  @Delete(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bỏ theo dõi một người dùng' })
  @ApiResponse({ status: 200, description: 'Bỏ theo dõi thành công' })
  @ApiResponse({ status: 404, description: 'Chưa theo dõi người dùng này' })
  async unfollowUser(
    @Req() req: any,
    @Param('userId') targetUserId: string,
  ): Promise<{ message: string }> {
    return this.userFollowService.unfollowUser(req.user.id, targetUserId);
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
  async getFollowers(
    @Param('userId') targetUserId: string,
  ): Promise<GetFollowersResponseDto> {
    return this.userFollowService.getFollowers(targetUserId);
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
  async getFollowing(
    @Param('userId') targetUserId: string,
  ): Promise<GetFollowingResponseDto> {
    return this.userFollowService.getFollowing(targetUserId);
  }
}
