import { IsString, IsBoolean, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SkillCategoryName } from '../enums';

export class UpdateSkillDto {
  @ApiPropertyOptional({
    example: 'TypeScript',
    description: 'Tên kỹ năng mới',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  skillName?: string;

  @ApiPropertyOptional({
    example: 'PROGRAMMING',
    description: 'Danh mục kỹ năng',
    enum: SkillCategoryName,
  })
  @IsEnum(SkillCategoryName)
  @IsOptional()
  category?: SkillCategoryName;

  @ApiPropertyOptional({
    example: true,
    description: 'Đánh dấu là kỹ năng thế mạnh',
  })
  @IsBoolean()
  @IsOptional()
  isStrong?: boolean;
}
