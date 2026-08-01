import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthClient } from '../clients/auth.client';
import { RegisterDto, LoginDto, VerifyOtpDto } from '@app/contracts/auth';

@ApiTags('Auth - Xác thực')
@Controller('auth')
export class AuthRoutes {
  constructor(private readonly authClient: AuthClient) {}

  /** Đăng ký tài khoản mới - gửi OTP về email */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'OTP đã được gửi đến email',
    schema: {
      example: {
        message: 'Đã gửi mã OTP đến email của bạn',
        email: 'student@gmail.com',
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email đã được đăng ký' })
  async register(@Body() dto: RegisterDto) {
    return this.authClient.register(dto);
  }

  /** Xác thực OTP - kích hoạt tài khoản và nhận tokens */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực OTP' })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Xác thực thành công, trả về tokens',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 86400,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'student@gmail.com',
          role: 'USER',
          status: 'ACTIVE',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'OTP không hợp lệ hoặc đã hết hạn' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authClient.verifyOtp(dto);
  }

  /** Đăng nhập bằng email và mật khẩu */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 86400,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'student@gmail.com',
          role: 'USER',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng' })
  async login(@Body() dto: LoginDto) {
    return this.authClient.login(dto);
  }

  /** Làm mới access token bằng refresh token */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token' })
  @ApiResponse({
    status: 200,
    description: 'Trả về tokens mới',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 86400,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ' })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authClient.refresh(body);
  }

  /** Đăng xuất - thu hồi refresh token */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất' })
  @ApiResponse({
    status: 200,
    description: 'Đăng xuất thành công',
    schema: {
      example: {
        message: 'Đăng xuất thành công',
      },
    },
  })
  async logout(@Body() body: { refreshToken?: string }) {
    return this.authClient.logout(body);
  }
}
