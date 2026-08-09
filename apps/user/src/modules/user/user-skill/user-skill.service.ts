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
   * Thêm kỹ năng mới (tự động khởi tạo profile nếu tài khoản mới chưa có record trong bảng user_profile)
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

    return this.toSkillDto(saved);
  }

  /**
   * Cập nhật thông tin kỹ năng (tên, danh mục, hoặc trạng thái kỹ năng thế mạnh)
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
      const duplicate = allUserSkills.find(
        (s) => s.id !== skillId && s.skillName.trim().toLowerCase() === trimmedName.toLowerCase(),
      );

      if (duplicate) {
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

    const saved = await this.userSkillRepo.save(skill);
    return this.toSkillDto(saved);
  }

  /**
   * Xoá kỹ năng
   */
  async deleteSkill(userId: string, skillId: string): Promise<void> {
    const skill = await this.userSkillRepo.findOne({
      where: { id: skillId, userId },
    });

    if (!skill) {
      throw new NotFoundException('Không tìm thấy kỹ năng để xoá');
    }

    await this.userSkillRepo.remove(skill);
  }

  /**
   * Chuyển Entity sang DTO
   */
  private toSkillDto(entity: UserSkill): SkillDto {
    return {
      id: entity.id,
      skillName: entity.skillName,
      category: entity.category,
      isStrong: entity.isStrong,
      addedAt: entity.addedAt,
    };
  }
}
