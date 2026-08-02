import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Tên hiển thị',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Sinh viên năm 3 chuyên ngành Công nghệ thông tin',
    description: 'Tiểu sử cá nhân',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;
}
