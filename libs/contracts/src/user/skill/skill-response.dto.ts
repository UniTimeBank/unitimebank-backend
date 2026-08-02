import { ApiProperty } from '@nestjs/swagger';
import { SkillCategoryName } from '../enums';

export class SkillDto {
  @ApiProperty({ example: 'uuid-string', description: 'ID kỹ năng' })
  id: string;

  @ApiProperty({ example: 'JavaScript', description: 'Tên kỹ năng' })
  skillName: string;

  @ApiProperty({
    example: 'PROGRAMMING',
    description: 'Danh mục',
    enum: SkillCategoryName,
  })
  category: SkillCategoryName;

  @ApiProperty({ example: true, description: 'Kỹ năng mạnh' })
  isStrong: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', description: 'Thời điểm thêm' })
  addedAt: Date;
}

export class GetMySkillsResponseDto {
  @ApiProperty({ type: [SkillDto], description: 'Danh sách kỹ năng' })
  skills: SkillDto[];
}

export class SkillCategoryDto {
  @ApiProperty({ example: 'uuid-string', description: 'ID danh mục' })
  id: string;

  @ApiProperty({
    example: 'PROGRAMMING',
    description: 'Tên danh mục',
    enum: SkillCategoryName,
  })
  name: SkillCategoryName;

  @ApiProperty({ example: 1, description: 'Thứ tự hiển thị' })
  displayOrder: number;
}

export class GetSkillCategoriesResponseDto {
  @ApiProperty({ type: [SkillCategoryDto], description: 'Danh sách danh mục' })
  categories: SkillCategoryDto[];
}
