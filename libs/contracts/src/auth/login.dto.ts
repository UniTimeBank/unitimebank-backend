import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'student@gmail.com', description: 'Email đăng nhập' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: 'SecurePass123', description: 'Mật khẩu' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password: string;

  @ApiPropertyOptional({ example: 'device-uuid-123', description: 'ID thiết bị (tùy chọn)' })
  @IsString()
  @IsOptional()
  deviceId?: string;
}
