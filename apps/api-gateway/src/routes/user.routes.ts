import { Controller, Get, Patch, Body, Param, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { UserClient } from '../clients/user.client';
import { UpdateProfileDto, GetUserProfileResponseDto, GetPublicProfileResponseDto } from '@app/contracts/user';

@ApiTags('User - Người dùng')
@Controller('users')
export class UserRoutes {
  constructor(private readonly userClient: UserClient) { }

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

  /** Lấy thông tin profile công khai của một user */
  @Get(':userId')
  @ApiOperation({ summary: 'Lấy thông tin profile công khai' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin profile công khai',
    type: GetPublicProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async getPublicProfile(@Param('userId') userId: string) {
    return this.userClient.getPublicProfile(userId);
  }
}
