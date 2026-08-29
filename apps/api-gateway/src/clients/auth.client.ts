import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class AuthClient {
  private readonly AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  private async request(method: string, path: string, data?: any) {
    const url = `${this.AUTH_SERVICE_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) {
      options.body = JSON.stringify(data);
    }
    try {
      const response = await fetch(url, options);
      const result = await response.json();
      if (!response.ok) {
        throw new HttpException(
          result.message || result.error || 'Lỗi xử lý hệ thống',
          response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return result;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        'Không thể kết nối đến Dịch vụ Xác thực',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async register(data: any) {
    return this.request('POST', '/auth/register', data);
  }

  async verifyOtp(data: any) {
    return this.request('POST', '/auth/verify-otp', data);
  }

  async login(data: any) {
    return this.request('POST', '/auth/login', data);
  }

  async googleLogin(data: any) {
    return this.request('POST', '/auth/google', data);
  }

  async setPassword(data: any) {
    return this.request('POST', '/auth/set-password', data);
  }

  async changePassword(data: { userId: string; oldPassword: string; newPassword: string }) {
    return this.request('POST', '/auth/change-password', data);
  }

  // ========== QUÊN MẬT KHẨU ==========
  async forgotPassword(email: string) {
    return this.request('POST', '/auth/forgot-password', { email });
  }

  async resetPassword(data: { email: string; code: string; newPassword: string }) {
    return this.request('POST', '/auth/reset-password', data);
  }

  async refresh(data: any) {
    return this.request('POST', '/auth/refresh', data);
  }

  async logout(data: any) {
    return this.request('POST', '/auth/logout', data);
  }

  // ========== ADMIN ACCOUNT MANAGEMENT ==========

  async getAdminAccounts(params: { search?: string; role?: string; status?: string; page?: number; limit?: number }) {
    let queryStr = '';
    const queryParams: string[] = [];
    if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
    if (params.role) queryParams.push(`role=${encodeURIComponent(params.role)}`);
    if (params.status) queryParams.push(`status=${encodeURIComponent(params.status)}`);
    if (params.page) queryParams.push(`page=${params.page}`);
    if (params.limit) queryParams.push(`limit=${params.limit}`);
    if (queryParams.length > 0) queryStr = `?${queryParams.join('&')}`;

    return this.request('GET', `/auth/admin/accounts${queryStr}`);
  }

  async updateAccountStatus(id: string, status: string) {
    return this.request('PATCH', `/auth/admin/accounts/${id}/status`, { status });
  }

  async updateAccountRole(id: string, role: string) {
    return this.request('PATCH', `/auth/admin/accounts/${id}/role`, { role });
  }

  async adminResetPassword(id: string, newPassword?: string) {
    return this.request('POST', `/auth/admin/accounts/${id}/reset-password`, { newPassword });
  }
}
