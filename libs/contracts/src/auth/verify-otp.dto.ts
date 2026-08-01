import { IsEmail, IsString, IsEnum, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OtpPurpose {
  REGISTER = 'REGISTER',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'student@gmail.com', description: 'Email đã đăng ký' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Mã OTP 6 số' })
  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải có 6 số' })
  code: string;

  @ApiProperty({ example: 'REGISTER', enum: OtpPurpose, description: 'Loại OTP' })
  @IsEnum(OtpPurpose, { message: 'Loại OTP không hợp lệ' })
  purpose: OtpPurpose;
}
