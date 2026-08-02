import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserSkillCategoryService } from './user-skill-category.service';
import { GetSkillCategoriesResponseDto } from '@app/contracts/user';

@ApiTags('User - Skill Categories')
@Controller('skills/categories')
export class UserSkillCategoryController {
  constructor(
    private readonly categoryService: UserSkillCategoryService,
  ) {}

  /** Lấy danh sách danh mục kỹ năng */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách danh mục kỹ năng' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách danh mục',
    type: GetSkillCategoriesResponseDto,
  })
  async getCategories(): Promise<GetSkillCategoriesResponseDto> {
    return this.categoryService.getCategories();
  }
}
