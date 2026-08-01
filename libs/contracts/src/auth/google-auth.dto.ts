import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google ID Token hoặc Credential từ Google OAuth Client',
    example: 'eyJhbGciOiJSUzI1NiIs...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token Google không được để trống' })
  idToken: string;

  @ApiProperty({
    description: 'Tên hiển thị từ Google (nếu có)',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsString()
  @IsOptional()
  displayName?: string;
}
