import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillCategory } from '../entities/skill-category.entity';
import {
  SkillCategoryName,
  SkillCategoryDto,
  GetSkillCategoriesResponseDto,
} from '@app/contracts/user';


@Injectable()
export class UserSkillCategoryService implements OnModuleInit {
  constructor(
    @InjectRepository(SkillCategory)
    private readonly categoryRepo: Repository<SkillCategory>,
  ) {}

  /**
   * Seed categories mặc định khi app khởi động
   */
  async onModuleInit() {
    const defaultCategories = [
      { name: SkillCategoryName.PROGRAMMING, displayOrder: 1 },
      { name: SkillCategoryName.LANGUAGE, displayOrder: 2 },
      { name: SkillCategoryName.DESIGN, displayOrder: 3 },
      { name: SkillCategoryName.ACADEMIC, displayOrder: 4 },
      { name: SkillCategoryName.BUSINESS, displayOrder: 5 },
      { name: SkillCategoryName.SOFT_SKILLS, displayOrder: 6 },
      { name: SkillCategoryName.MUSIC, displayOrder: 7 },
      { name: SkillCategoryName.SPORTS, displayOrder: 8 },
      { name: SkillCategoryName.OTHER, displayOrder: 9 },
    ];

    for (const cat of defaultCategories) {
      const existing = await this.categoryRepo.findOne({
        where: { name: cat.name },
      });
      if (!existing) {
        await this.categoryRepo.save(
          this.categoryRepo.create({
            name: cat.name,
            displayOrder: cat.displayOrder,
            isActive: true,
          }),
        );
      }
    }
  }

  /**
   * Lấy tất cả danh mục kỹ năng
   */
  async getCategories(): Promise<GetSkillCategoriesResponseDto> {
    const categories = await this.categoryRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });

    return {
      categories: categories.map((c) => this.toCategoryDto(c)),
    };
  }

  /**
   * Chuyển entity sang DTO
   */
  private toCategoryDto(category: SkillCategory): SkillCategoryDto {
    return {
      id: category.id,
      name: category.name,
      displayOrder: category.displayOrder,
    };
  }
}
