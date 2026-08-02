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
   * Thêm kỹ năng mới
   */
  async createSkill(userId: string, dto: CreateSkillDto): Promise<SkillDto> {
    // Kiểm tra profile tồn tại
    const profile = await this.userProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Không tìm thấy profile');
    }

    // Kiểm tra trùng tên kỹ năng và danh mục của cùng 1 user
    const existing = await this.userSkillRepo.findOne({
      where: { userId, skillName: dto.skillName, category: dto.category },
    });

    if (existing) {
      throw new ConflictException('Kỹ năng này đã tồn tại trong hồ sơ của bạn');
    }

    const skill = this.userSkillRepo.create({
      userId,
      skillName: dto.skillName.trim(),
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
      const categoryToCheck = dto.category || skill.category;

      // Kiểm tra trùng lặp nếu đổi tên hoặc category
      const existing = await this.userSkillRepo.findOne({
        where: { userId, skillName: trimmedName, category: categoryToCheck },
      });

      if (existing && existing.id !== skillId) {
        throw new ConflictException('Tên kỹ năng bị trùng trong cùng danh mục');
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
   * Xóa kỹ năng khỏi profile
   */
  async deleteSkill(userId: string, skillId: string): Promise<{ message: string }> {
    const skill = await this.userSkillRepo.findOne({
      where: { id: skillId, userId },
    });

    if (!skill) {
      throw new NotFoundException('Không tìm thấy kỹ năng');
    }

    await this.userSkillRepo.remove(skill);

    return { message: 'Xóa kỹ năng thành công' };
  }

  /**
   * Chuyển đổi entity sang DTO
   */
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
