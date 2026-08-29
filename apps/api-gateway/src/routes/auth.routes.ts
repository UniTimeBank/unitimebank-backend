import { Controller, Post, Get, Patch, Param, Query, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { Role } from '@app/contracts';
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
  })
  async register(@Body() dto: RegisterDto) {
    return this.authClient.register(dto);
  }

  /** Xác thực OTP - kích hoạt tài khoản và nhận tokens */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực OTP' })
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authClient.verifyOtp(dto);
  }

  /** Đăng nhập bằng email và mật khẩu */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiBody({ type: LoginDto })
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
  async changePassword(@Body() dto: { userId: string; oldPassword: string; newPassword: string }) {
    return this.authClient.changePassword(dto);
  }

  // ========== QUÊN MẬT KHẨU ==========

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Quên mật khẩu - gửi OTP' })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authClient.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu với OTP' })
  async resetPassword(@Body() dto: { email: string; code: string; newPassword: string }) {
    return this.authClient.resetPassword(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token' })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authClient.refresh(body);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất' })
  async logout(@Body() body: { refreshToken?: string }) {
    return this.authClient.logout(body);
  }

  // ========== ADMIN ACCOUNT MANAGEMENT ==========

  @Get('admin/accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin - Lấy danh sách tài khoản hệ thống' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAdminAccounts(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.authClient.getAdminAccounts({ search, role, status, page, limit });
  }

  @Patch('admin/accounts/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin - Cập nhật trạng thái tài khoản (ACTIVE, LOCKED)' })
  async updateAccountStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.authClient.updateAccountStatus(id, status);
  }

  @Patch('admin/accounts/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin - Phân quyền vai trò tài khoản (USER, MODERATOR, ADMIN)' })
  async updateAccountRole(
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.authClient.updateAccountRole(id, role);
  }

  @Post('admin/accounts/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin - Cấp lại mật khẩu tạm thời cho tài khoản' })
  async adminResetPassword(
    @Param('id') id: string,
    @Body('newPassword') newPassword?: string,
  ) {
    return this.authClient.adminResetPassword(id, newPassword);
  }
}
