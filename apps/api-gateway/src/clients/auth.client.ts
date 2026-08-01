import { Injectable } from '@nestjs/common';

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
    const response = await fetch(url, options);
    return response.json();
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

  async refresh(data: any) {
    return this.request('POST', '/auth/refresh', data);
  }

  async logout(data: any) {
    return this.request('POST', '/auth/logout', data);
  }
}
