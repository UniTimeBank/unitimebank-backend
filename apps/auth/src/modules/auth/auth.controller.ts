import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, VerifyOtpDto, GoogleAuthDto } from '@app/contracts/auth';
import { MODERATION_EVENTS } from '@app/contracts/events';
import { Role, AccountStatus } from './enums';

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

  // ========== ADMIN ACCOUNT MANAGEMENT ==========

  @Get('admin/accounts')
  async getAdminAccounts(
    @Query('search') search?: string,
    @Query('role') role?: Role,
    @Query('status') status?: AccountStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.authService.getAdminAccounts({
      search,
      role,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Patch('admin/accounts/:id/status')
  async updateAccountStatus(
    @Param('id') id: string,
    @Body('status') status: AccountStatus,
  ) {
    return this.authService.updateAccountStatus(id, status);
  }

  @Patch('admin/accounts/:id/role')
  async updateAccountRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    return this.authService.updateAccountRole(id, role);
  }

  @Post('admin/accounts/:id/reset-password')
  async adminResetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword?: string,
  ) {
    return this.authService.adminResetPassword(id, newPassword);
  }

  // ========== RABBITMQ EVENT PATTERN ==========

  @EventPattern(MODERATION_EVENTS.TRUST_SCORE_UPDATED)
  async handleTrustScoreUpdated(@Payload() data: { userId: string; score: number }) {
    if (!data?.userId) return;
    try {
      await this.authService.updateTrustScore(data.userId, data.score);
    } catch (err) {
      console.error('[AUTH EVENT] Error updating trust score:', err);
    }
  }
}
