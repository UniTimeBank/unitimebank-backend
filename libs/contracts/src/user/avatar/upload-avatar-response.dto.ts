import { ApiProperty } from '@nestjs/swagger';

export class UploadAvatarResponseDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v123456/unitimebank/avatars/user123.jpg',
    description: 'URL ảnh đại diện vừa upload thành công',
  })
  avatarUrl: string;
}
