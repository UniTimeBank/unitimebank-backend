import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class UserClient {
  private readonly USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002';

  private async request(method: string, path: string, data?: any, headers?: Record<string, string>) {
    const url = `${this.USER_SERVICE_URL}${path}`;
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;

    const requestHeaders: Record<string, string> = { ...headers };
    if (!isFormData) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (data) {
      options.body = isFormData ? data : JSON.stringify(data);
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

  // ============ Profile ============

  async getMyProfile(headers: Record<string, string>) {
    return this.request('GET', '/users/me', undefined, headers);
  }

  async updateProfile(data: any, headers: Record<string, string>) {
    return this.request('PATCH', '/users/me', data, headers);
  }

  async getPublicProfile(userId: string) {
    return this.request('GET', `/users/${userId}`);
  }

  // ============ Avatar ============

  async uploadAvatar(file: Express.Multer.File, headers: Record<string, string>) {
    if (!file) {
      throw new HttpException('Chưa chọn file ảnh', HttpStatus.BAD_REQUEST);
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    formData.append('avatar', blob, file.originalname || 'avatar.jpg');

    return this.request('POST', '/users/me/avatar', formData, headers);
  }

  // ============ Daily Check-in Streak ============

  async checkIn(headers: Record<string, string>) {
    return this.request('POST', '/users/me/check-in', undefined, headers);
  }

  async getCheckInStatus(headers: Record<string, string>) {
    return this.request('GET', '/users/me/check-in', undefined, headers);
  }

  // ============ Follow System ============

  async followUser(targetUserId: string, headers: Record<string, string>) {
    return this.request('POST', `/users/${targetUserId}/follow`, undefined, headers);
  }

  async unfollowUser(targetUserId: string, headers: Record<string, string>) {
    return this.request('DELETE', `/users/${targetUserId}/follow`, undefined, headers);
  }

  async getFollowers(targetUserId: string) {
    return this.request('GET', `/users/${targetUserId}/followers`);
  }

  async getFollowing(targetUserId: string) {
    return this.request('GET', `/users/${targetUserId}/following`);
  }

  // ============ Skills ============

  async getMySkills(headers: Record<string, string>) {
    return this.request('GET', '/users/me/skills', undefined, headers);
  }

  async getSkillsByUserId(userId: string) {
    return this.request('GET', `/users/${userId}/skills`);
  }

  async createSkill(data: any, headers: Record<string, string>) {
    return this.request('POST', '/users/me/skills', data, headers);
  }

  async updateSkill(skillId: string, data: any, headers: Record<string, string>) {
    return this.request('PATCH', `/users/me/skills/${skillId}`, data, headers);
  }

  async deleteSkill(skillId: string, headers: Record<string, string>) {
    return this.request('DELETE', `/users/me/skills/${skillId}`, undefined, headers);
  }

  // ============ Skill Categories ============

  async getSkillCategories() {
    return this.request('GET', '/skills/categories');
  }
}
