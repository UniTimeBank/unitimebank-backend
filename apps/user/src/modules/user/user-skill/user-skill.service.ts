import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSkill } from '../entities/user-skill.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { RewardType } from '../enums';
import { UserProfileService } from '../user-profile/user-profile.service';
import {
  CreateSkillDto,
  UpdateSkillDto,
  SkillDto,
  GetMySkillsResponseDto,
} from '@app/contracts/user';

@Injectable()
export class UserSkillService {
  constructor(
    @InjectRepository(UserSkill)
    private readonly userSkillRepo: Repository<UserSkill>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
    private readonly userProfileService: UserProfileService,
  ) {}

  /**
   * Lấy danh sách kỹ năng của user hiện tại
   */
  async getMySkills(userId: string): Promise<GetMySkillsResponseDto> {
    const skills = await this.userSkillRepo.find({
      where: { userId },
      order: { addedAt: 'DESC' },
    });

    return {
      skills: skills.map((s) => this.toSkillDto(s)),
    };
  }

  /**
   * Lấy danh sách kỹ năng công khai của một user
   */
  async getSkillsByUserId(userId: string): Promise<GetMySkillsResponseDto> {
    const profile = await this.userProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const skills = await this.userSkillRepo.find({
      where: { userId },
      order: { isStrong: 'DESC', addedAt: 'DESC' },
    });

    return {
      skills: skills.map((s) => this.toSkillDto(s)),
    };
  }

  /**
   * Thêm kỹ năng mới (tự động thưởng 10 credit nếu là kỹ năng đầu tiên)
   */
  async createSkill(userId: string, dto: CreateSkillDto): Promise<SkillDto> {
    // Đảm bảo profile tồn tại
    let profile = await this.userProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.userProfileRepo.create({
        userId,
        displayName: '',
        avatarUrl: '',
        bio: '',
        trustScore: 30,
        onboardingCompleted: false,
      });
      await this.userProfileRepo.save(profile);
    }

    const trimmedName = dto.skillName.trim();
    // Kiểm tra trùng tên kỹ năng của cùng 1 user (không phân biệt danh mục và không phân biệt hoa thường)
    const allUserSkills = await this.userSkillRepo.find({ where: { userId } });
    const isDuplicate = allUserSkills.some(
      (s) => s.skillName.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (isDuplicate) {
      throw new ConflictException(`Kỹ năng "${trimmedName}" đã tồn tại trong hồ sơ của bạn.`);
    }

    const skill = this.userSkillRepo.create({
      userId,
      skillName: trimmedName,
      category: dto.category,
      isStrong: dto.isStrong ?? false,
    });

    const saved = await this.userSkillRepo.save(skill);

    // Tự động kiểm tra và trao 10 Credit thưởng tạo Kỹ năng đầu tiên
    try {
      await this.userProfileService.checkAndRewardTask(userId, RewardType.PROFILE_SKILL, 10);
    } catch (err) {
      console.error('[SKILL] Error rewarding skill task:', err);
    }

    return this.toSkillDto(saved);
  }

  /**
   * Cập nhật thông tin kỹ năng
   */
  async updateSkill(
    userId: string,
    skillId: string,
    dto: UpdateSkillDto,
  ): Promise<SkillDto> {
    const skill = await this.userSkillRepo.findOne({
      where: { id: skillId, userId },
    });

    if (!skill) {
      throw new NotFoundException('Không tìm thấy kỹ năng');
    }

    if (dto.skillName !== undefined) {
      const trimmedName = dto.skillName.trim();
      const allUserSkills = await this.userSkillRepo.find({ where: { userId } });
      const isDuplicate = allUserSkills.some(
        (s) => s.id !== skillId && s.skillName.trim().toLowerCase() === trimmedName.toLowerCase(),
      );

      if (isDuplicate) {
        throw new ConflictException(`Kỹ năng "${trimmedName}" đã tồn tại trong hồ sơ của bạn.`);
      }
      skill.skillName = trimmedName;
    }

    if (dto.category !== undefined) {
      skill.category = dto.category;
    }

    if (dto.isStrong !== undefined) {
      skill.isStrong = dto.isStrong;
    }

    const updated = await this.userSkillRepo.save(skill);
    return this.toSkillDto(updated);
  }

  /**
   * Xóa kỹ năng
   */
  async deleteSkill(userId: string, skillId: string): Promise<void> {
    const skill = await this.userSkillRepo.findOne({
      where: { id: skillId, userId },
    });

    if (!skill) {
      throw new NotFoundException('Không tìm thấy kỹ năng');
    }

    await this.userSkillRepo.remove(skill);
  }

  private toSkillDto(skill: UserSkill): SkillDto {
    return {
      id: skill.id,
      skillName: skill.skillName,
      category: skill.category,
      isStrong: skill.isStrong,
      addedAt: skill.addedAt,
    };
  }
}
