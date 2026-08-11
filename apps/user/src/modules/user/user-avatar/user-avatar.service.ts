import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '../entities/user-profile.entity';
import { CloudinaryService } from '@app/common/cloudinary';
import { UploadAvatarResponseDto } from '@app/contracts/user';
import { UserProfileService } from '../user-profile/user-profile.service';

@Injectable()
export class UserAvatarService {
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  constructor(
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly userProfileService: UserProfileService,
  ) {}

  /**
   * Upload và cập nhật ảnh đại diện sinh viên
   */
  async uploadAvatar(
    userId: string,
    file: any,
  ): Promise<UploadAvatarResponseDto> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh để tải lên');
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, GIF',
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('Kích thước file vượt quá giới hạn 5MB');
    }

    let profile = await this.userProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.userProfileRepo.create({
        userId,
        displayName: '',
        avatarUrl: '',
        bio: '',
        trustScore: 100,
        onboardingCompleted: false,
      });
    }

    // Upload lên Cloudinary với publicId định danh theo userId
    const publicId = `avatar_${userId}`;
    const result = await this.cloudinaryService.uploadImage(
      file.buffer,
      'unitimebank/avatars',
      publicId,
    );

    // Cập nhật avatarUrl trong profile
    profile.avatarUrl = result.url;
    await this.userProfileRepo.save(profile);

    // Tự động kiểm tra và trao 10 Credit thưởng nếu đủ Avatar + Bio
    try {
      await this.userProfileService.checkAndRewardProfileComplete(userId);
    } catch (err) {
      console.error('[AVATAR] Error rewarding profile complete task:', err);
    }

    return {
      avatarUrl: result.url,
    };
  }
}
