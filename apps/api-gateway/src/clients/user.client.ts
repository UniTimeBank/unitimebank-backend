import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class UserClient {
  private readonly USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

  private async request(method: string, path: string, data?: any, headers?: Record<string, string>) {
    const url = `${this.USER_SERVICE_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
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
        'Không thể kết nối đến Dịch vụ Người dùng',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async getMyProfile(headers: Record<string, string>) {
    return this.request('GET', '/users/me', undefined, headers);
  }

  async updateProfile(data: any, headers: Record<string, string>) {
    return this.request('PATCH', '/users/me', data, headers);
  }

  async getPublicProfile(userId: string) {
    return this.request('GET', `/users/${userId}`);
  }
}
