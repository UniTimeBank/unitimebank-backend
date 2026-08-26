import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '../entities/user-profile.entity';
import { CloudinaryService } from '@app/common/cloudinary';
import { ConfirmAvatarUploadDto, UploadAvatarResponseDto } from '@app/contracts';
import { UserProfileService } from '../user-profile/user-profile.service';

@Injectable()
export class UserAvatarService {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  constructor(
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly userProfileService: UserProfileService,
  ) {}

  /**
   * Xác minh direct upload Cloudinary và cập nhật ảnh đại diện sinh viên.
   */
  async uploadAvatar(
    userId: string,
    dto: ConfirmAvatarUploadDto,
  ): Promise<UploadAvatarResponseDto> {
    const expectedPublicId = `unitimebank/avatars/avatar_${userId}`;
    if (dto.publicId !== expectedPublicId || dto.resourceType !== 'image') {
      throw new BadRequestException('Ảnh đại diện không khớp quyền upload đã cấp');
    }

    const asset = await this.cloudinaryService.verifyDirectUpload({
      publicId: dto.publicId,
      resourceType: 'image',
      expectedPublicIdPrefix: expectedPublicId,
      maxBytes: this.MAX_FILE_SIZE,
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    });

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

    // Cập nhật avatarUrl trong profile
    profile.avatarUrl = asset.url;
    await this.userProfileRepo.save(profile);

    // Tự động kiểm tra và trao 10 Credit thưởng nếu đủ Avatar + Bio
    try {
      await this.userProfileService.checkAndRewardProfileComplete(userId);
    } catch (err) {
      console.error('[AVATAR] Error rewarding profile complete task:', err);
    }

    return {
      avatarUrl: asset.url,
    };
  }
}
