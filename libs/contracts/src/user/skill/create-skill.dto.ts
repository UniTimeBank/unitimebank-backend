import { IsString, IsBoolean, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SkillCategoryName } from '../enums';

export class CreateSkillDto {
  @ApiProperty({
    example: 'JavaScript',
    description: 'Tên kỹ năng',
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  skillName: string;

  @ApiProperty({
    example: 'PROGRAMMING',
    description: 'Danh mục kỹ năng',
    enum: SkillCategoryName,
  })
  @IsEnum(SkillCategoryName)
  category: SkillCategoryName;

  @ApiPropertyOptional({
    example: true,
    description: 'Kỹ năng mạnh',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isStrong?: boolean;
}
