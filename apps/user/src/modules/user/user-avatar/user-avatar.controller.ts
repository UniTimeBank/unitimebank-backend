import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UserAvatarService } from './user-avatar.service';
import { UploadAvatarResponseDto } from '@app/contracts/user';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';

@ApiTags('User - Avatar')
@Controller('users/me/avatar')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserAvatarController {
  constructor(private readonly userAvatarService: UserAvatarService) {}

  /** Upload ảnh đại diện */
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
  @ApiResponse({ status: 400, description: 'File không hợp lệ hoặc quá lớn' })
  async uploadAvatar(
    @Req() req: any,
    @UploadedFile() file: any,
  ): Promise<UploadAvatarResponseDto> {
    return this.userAvatarService.uploadAvatar(req.user.id, file);
  }
}
