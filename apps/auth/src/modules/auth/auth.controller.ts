import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, VerifyOtpDto, GoogleAuthDto, SetPasswordDto } from '@app/contracts/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: GoogleAuthDto) {
    return this.authService.googleLogin(dto);
  }

  // ========== QUÊN MẬT KHẨU ==========

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: { email: string; code: string; newPassword: string }) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  // ========== ĐẶT LẠI MẬT KHẨU (khi đã đăng nhập) ==========

  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  async setPassword(@Body() body: { userId: string; newPassword: string }) {
    return this.authService.setPassword(body.userId, { newPassword: body.newPassword });
  }

  // Đổi MK khi đã đăng nhập - cần verify MK cũ
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() body: { userId: string; oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(body.userId, body.oldPassword, body.newPassword);
  }

  // ========== TOKEN ==========

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { refreshToken?: string }) {
    return this.authService.logout(body.refreshToken || '');
  }
}
