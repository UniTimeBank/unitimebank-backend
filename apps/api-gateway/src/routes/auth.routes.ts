import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthClient } from '../clients/auth.client';
import { RegisterDto, LoginDto, VerifyOtpDto, GoogleAuthDto, SetPasswordDto } from '@app/contracts/auth';

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

  /** Đăng nhập hoặc đăng ký bằng Google */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập Google' })
  @ApiBody({ type: GoogleAuthDto })
  async googleLogin(@Body() dto: GoogleAuthDto) {
    return this.authClient.googleLogin(dto);
  }

  /** Thiết lập hoặc đổi mật khẩu mới cho tài khoản */
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thiết lập mật khẩu' })
  @ApiBody({ type: SetPasswordDto })
  async setPassword(@Body() dto: SetPasswordDto & { userId: string }) {
    return this.authClient.setPassword(dto);
  }

  /** Đổi mật khẩu - yêu cầu mật khẩu cũ */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu (cần MK cũ)' })
  @ApiResponse({ status: 401, description: 'Mật khẩu hiện tại không đúng' })
  async changePassword(@Body() dto: { userId: string; oldPassword: string; newPassword: string }) {
    return this.authClient.changePassword(dto);
  }

  // ========== QUÊN MẬT KHẨU ==========

  /** Gửi yêu cầu đặt lại mật khẩu - nhận OTP qua email */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quên mật khẩu - gửi OTP' })
  @ApiResponse({
    status: 200,
    description: 'OTP đã được gửi nếu email tồn tại',
    schema: {
      example: {
        message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi mã OTP đến email của bạn.',
        email: 'student@gmail.com',
      },
    },
  })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authClient.forgotPassword(body.email);
  }

  /** Đặt lại mật khẩu với OTP */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu với OTP' })
  @ApiResponse({
    status: 200,
    description: 'Đặt lại mật khẩu thành công',
    schema: {
      example: {
        message: 'Đặt lại mật khẩu thành công. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'OTP không hợp lệ hoặc đã hết hạn' })
  async resetPassword(@Body() dto: { email: string; code: string; newPassword: string }) {
    return this.authClient.resetPassword(dto);
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
