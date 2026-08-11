import {
  Injectable,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { UserProfile } from '../entities/user-profile.entity';
import { FollowRelation } from '../entities/follow-relation.entity';
import { OnboardingReward } from '../entities/onboarding-reward.entity';
import { UserSkill } from '../entities/user-skill.entity';
import { MentorRecurringSchedule } from '../entities/mentor-recurring-schedule.entity';
import { LoginStreak } from '../entities/login-streak.entity';
import { RewardType } from '../enums';
import {
  UpdateProfileDto,
  GetUserProfileResponseDto,
  GetPublicProfileResponseDto,
  GetOnboardingTasksResponseDto,
} from '@app/contracts/user';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
    @InjectRepository(FollowRelation)
    private readonly followRepo: Repository<FollowRelation>,
    @InjectRepository(OnboardingReward)
    private readonly onboardingRewardRepo: Repository<OnboardingReward>,
    @InjectRepository(UserSkill)
    private readonly userSkillRepo: Repository<UserSkill>,
    @InjectRepository(MentorRecurringSchedule)
    private readonly scheduleRepo: Repository<MentorRecurringSchedule>,
    @InjectRepository(LoginStreak)
    private readonly loginStreakRepo: Repository<LoginStreak>,
    @Inject('WALLET_SERVICE')
    private readonly walletClient: ClientProxy,
  ) {}

  /**
   * Lấy profile của user hiện tại (authenticated user)
   */
  async getMyProfile(userId: string): Promise<GetUserProfileResponseDto> {
    const profile = await this.findOrCreateProfile(userId);
    const followersCount = await this.followRepo.count({ where: { followeeId: userId } });
    const followingCount = await this.followRepo.count({ where: { followerId: userId } });

    // Kiểm tra tự động hoàn thành nhiệm vụ thông tin cá nhân
    await this.checkAndRewardProfileComplete(userId);

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      trustScore: profile.trustScore,
      onboardingCompleted: profile.onboardingCompleted,
      followersCount,
      followingCount,
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

    // Kiểm tra thưởng 10 credit nếu đã đủ avatarUrl + bio
    await this.checkAndRewardProfileComplete(userId);

    return this.getMyProfile(userId);
  }

  /**
   * Kiểm tra và trao thưởng nhiệm vụ nếu chưa nhận (Idempotent)
   */
  async checkAndRewardTask(
    userId: string,
    rewardType: RewardType,
    creditAmount: number = 10,
  ): Promise<boolean> {
    const existing = await this.onboardingRewardRepo.findOne({
      where: { userId, rewardType },
    });
    if (existing) return false;

    const reward = this.onboardingRewardRepo.create({
      userId,
      rewardType,
      creditAmount,
    });
    await this.onboardingRewardRepo.save(reward);

    // Cập nhật cờ onboardingCompleted cho profile nếu cần
    await this.userProfileRepo.update({ userId }, { onboardingCompleted: true });

    // Phát sự kiện credit.reward sang Wallet Microservice
    try {
      this.walletClient.emit('credit.reward', {
        userId,
        rewardType,
        amount: creditAmount,
        sourceEvent: `onboarding_${rewardType.toLowerCase()}`,
      });
      this.logger.log(`Emitted credit.reward event for user ${userId} (+${creditAmount} credits, type: ${rewardType})`);
    } catch (err) {
      this.logger.error(`Error emitting credit.reward event for ${rewardType}:`, err);
    }

    return true;
  }

  /**
   * Kiểm tra điều kiện hoàn thành thông tin cơ bản (Avatar + Bio) -> Thưởng 10 Credit
   */
  async checkAndRewardProfileComplete(userId: string): Promise<boolean> {
    const profile = await this.userProfileRepo.findOne({ where: { userId } });
    if (!profile) return false;

    const hasAvatar = Boolean(profile.avatarUrl && profile.avatarUrl.trim().length > 0);
    const hasBio = Boolean(profile.bio && profile.bio.trim().length > 0);

    if (hasAvatar && hasBio) {
      return this.checkAndRewardTask(userId, RewardType.PROFILE_COMPLETE, 10);
    }
    return false;
  }

  /**
   * Lấy danh sách tiến độ 4 nhiệm vụ nhận Credit của người dùng
   */
  async getOnboardingTasks(userId: string): Promise<GetOnboardingTasksResponseDto> {
    const profile = await this.findOrCreateProfile(userId);

    // Nhiệm vụ 1: Hoàn thành thông tin cá nhân (Avatar + Bio)
    const profileReward = await this.onboardingRewardRepo.findOne({
      where: { userId, rewardType: RewardType.PROFILE_COMPLETE },
    });
    const profileCompleted = Boolean(profileReward) || (Boolean(profile.avatarUrl) && Boolean(profile.bio));

    // Nhiệm vụ 2: Tạo lịch rảnh khả dụng
    const scheduleReward = await this.onboardingRewardRepo.findOne({
      where: { userId, rewardType: RewardType.PROFILE_SCHEDULE },
    });
    const scheduleCount = await this.scheduleRepo.count({ where: { mentorId: userId } });
    const scheduleCreated = Boolean(scheduleReward) || scheduleCount > 0;

    // Nhiệm vụ 3: Thêm kỹ năng cá nhân
    const skillReward = await this.onboardingRewardRepo.findOne({
      where: { userId, rewardType: RewardType.PROFILE_SKILL },
    });
    const skillCount = await this.userSkillRepo.count({ where: { userProfile: { userId } } });
    const skillAdded = Boolean(skillReward) || skillCount > 0;

    // Tính tổng bonus đã nhận từ 3 nhiệm vụ nhập liệu
    let totalBonusEarned = 0;
    if (profileCompleted) totalBonusEarned += 10;
    if (scheduleCreated) totalBonusEarned += 10;
    if (skillAdded) totalBonusEarned += 10;

    return {
      profileCompleted,
      scheduleCreated,
      skillAdded,
      totalBonusEarned,
      tasks: [
        {
          taskKey: 'PROFILE_COMPLETE',
          title: 'Hoàn thành thông tin cá nhân',
          description: 'Cập nhật ảnh đại diện và viết tiểu sử cá nhân',
          rewardCredits: 10,
          completed: profileCompleted,
        },
        {
          taskKey: 'PROFILE_SCHEDULE',
          title: 'Tạo lịch rảnh khả dụng',
          description: 'Thiết lập khung giờ rảnh để nhận hướng dẫn hoặc chia sẻ kỹ năng',
          rewardCredits: 10,
          completed: scheduleCreated,
        },
        {
          taskKey: 'PROFILE_SKILL',
          title: 'Khai báo kỹ năng chuyên môn',
          description: 'Thêm ít nhất 1 kỹ năng bạn thành thạo vào hồ sơ',
          rewardCredits: 10,
          completed: skillAdded,
        },
      ],
    };
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

    const followersCount = await this.followRepo.count({ where: { followeeId: targetUserId } });
    const followingCount = await this.followRepo.count({ where: { followerId: targetUserId } });

    return {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      trustScore: profile.trustScore,
      trustTier: this.getTrustTier(profile.trustScore),
      followersCount,
      followingCount,
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
   * Tạo profile mới nếu chưa tồn tại
   */
  async createProfile(userId: string, initialData?: { displayName?: string; avatarUrl?: string }): Promise<UserProfile> {
    let profile = await this.userProfileRepo.findOne({
      where: { userId },
      relations: { skills: true },
    });

    if (profile) {
      let needsSave = false;
      if (initialData?.displayName && (!profile.displayName || profile.displayName === '')) {
        profile.displayName = initialData.displayName;
        needsSave = true;
      }
      if (initialData?.avatarUrl && (!profile.avatarUrl || profile.avatarUrl === '')) {
        profile.avatarUrl = initialData.avatarUrl;
        needsSave = true;
      }
      if (needsSave) {
        return this.userProfileRepo.save(profile);
      }
      return profile;
    }

    profile = this.userProfileRepo.create({
      userId,
      displayName: initialData?.displayName || '',
      avatarUrl: initialData?.avatarUrl || '',
      bio: '',
      trustScore: 30,
      onboardingCompleted: false,
    });

    return this.userProfileRepo.save(profile);
  }

  /**
   * Cập nhật trust score
   */
  async updateTrustScore(userId: string, newScore: number): Promise<void> {
    await this.userProfileRepo.update({ userId }, { trustScore: newScore });
  }

  private getTrustTier(score: number): string {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 50) return 'AVERAGE';
    if (score >= 20) return 'WARNING';
    return 'LOCKED';
  }

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
