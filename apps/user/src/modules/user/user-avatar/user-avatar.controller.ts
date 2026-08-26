import {
  Controller,
  Post,
  UseGuards,
  Req,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserAvatarService } from './user-avatar.service';
import { ConfirmAvatarUploadDto, UploadAvatarResponseDto } from '@app/contracts';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';

@ApiTags('User - Avatar')
@Controller('users/me/avatar')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserAvatarController {
  constructor(private readonly userAvatarService: UserAvatarService) {}

  /** Upload ảnh đại diện */
  @Post()
  @ApiOperation({ summary: 'Xác minh ảnh đã direct upload và cập nhật avatar' })
  @ApiResponse({
    status: 201,
    description: 'Upload thành công',
    type: UploadAvatarResponseDto,
  })
  @ApiResponse({ status: 400, description: 'File không hợp lệ hoặc quá lớn' })
  async uploadAvatar(
    @Req() req: any,
    @Body() dto: ConfirmAvatarUploadDto,
  ): Promise<UploadAvatarResponseDto> {
    return this.userAvatarService.uploadAvatar(req.user.id, dto);
  }
}
