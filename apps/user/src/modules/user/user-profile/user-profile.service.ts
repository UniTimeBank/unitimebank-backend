import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '../entities/user-profile.entity';
import {
  UpdateProfileDto,
  GetUserProfileResponseDto,
  GetPublicProfileResponseDto,
} from '@app/contracts/user';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
  ) {}

  /**
   * Lấy profile của user hiện tại (authenticated user)
   */
  async getMyProfile(userId: string): Promise<GetUserProfileResponseDto> {
    const profile = await this.findOrCreateProfile(userId);

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      trustScore: profile.trustScore,
      onboardingCompleted: profile.onboardingCompleted,
      skills: (profile.skills || []).map((s) => ({
        id: s.id,
        skillName: s.skillName,
        category: s.category,
        isStrong: s.isStrong,
        addedAt: s.addedAt,
      })),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Cập nhật profile của user hiện tại
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<GetUserProfileResponseDto> {
    const profile = await this.findOrCreateProfile(userId);

    if (dto.displayName !== undefined) {
      profile.displayName = dto.displayName;
    }
    if (dto.bio !== undefined) {
      profile.bio = dto.bio;
    }

    await this.userProfileRepo.save(profile);

    return this.getMyProfile(userId);
  }

  /**
   * Lấy profile công khai của một user
   */
  async getPublicProfile(targetUserId: string): Promise<GetPublicProfileResponseDto> {
    const profile = await this.userProfileRepo.findOne({
      where: { userId: targetUserId },
      relations: { skills: true },
    });

    if (!profile) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      trustScore: profile.trustScore,
      trustTier: this.getTrustTier(profile.trustScore),
      skills: (profile.skills || []).map((s) => ({
        id: s.id,
        skillName: s.skillName,
        category: s.category,
        isStrong: s.isStrong,
        addedAt: s.addedAt,
      })),
    };
  }

  /**
   * Tạo profile mới nếu chưa tồn tại (được gọi khi user đăng ký thành công)
   */
  async createProfile(userId: string): Promise<UserProfile> {
    const existing = await this.userProfileRepo.findOne({
      where: { userId },
      relations: { skills: true },
    });

    if (existing) {
      return existing;
    }

    const profile = this.userProfileRepo.create({
      userId,
      displayName: '',
      avatarUrl: '',
      bio: '',
      trustScore: 100,
      onboardingCompleted: false,
    });

    return this.userProfileRepo.save(profile);
  }

  /**
   * Cập nhật trust score (được gọi từ Moderation Service)
   */
  async updateTrustScore(userId: string, newScore: number): Promise<void> {
    await this.userProfileRepo.update({ userId }, { trustScore: newScore });
  }

  /**
   * Lấy trust tier dựa trên điểm
   */
  private getTrustTier(score: number): string {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 50) return 'AVERAGE';
    if (score >= 20) return 'WARNING';
    return 'LOCKED';
  }

  /**
   * Tìm hoặc tạo profile
   */
  private async findOrCreateProfile(userId: string): Promise<UserProfile> {
    let profile = await this.userProfileRepo.findOne({
      where: { userId },
      relations: { skills: true },
    });

    if (!profile) {
      profile = await this.createProfile(userId);
    }

    return profile;
  }
}
