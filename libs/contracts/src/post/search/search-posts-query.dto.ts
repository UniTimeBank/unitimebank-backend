import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, SkillCategoryName } from '../enums';

export class SearchPostsQueryDto {
  @ApiPropertyOptional({ example: 'Spring Boot', description: 'Từ khóa tìm kiếm (tiêu đề, kỹ năng, mô tả)' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ enum: SkillCategoryName, example: SkillCategoryName.PROGRAMMING, description: 'Lọc danh mục' })
  @IsEnum(SkillCategoryName)
  @IsOptional()
  category?: SkillCategoryName;

  @ApiPropertyOptional({ enum: SessionType, example: SessionType.BOTH, description: 'Lọc hình thức lớp' })
  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  @ApiPropertyOptional({ example: 90, description: 'Điểm uy tín tối thiểu của Mentor' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  trustScoreMin?: number;

  @ApiPropertyOptional({ example: 'MONDAY', description: 'Lọc theo thứ trong tuần' })
  @IsString()
  @IsOptional()
  dayOfWeek?: string;

  @ApiPropertyOptional({ example: 'newest', enum: ['newest', 'trustScore', 'relevance'], description: 'Tiêu chí sắp xếp' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'newest';

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Trang' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 12, default: 12, description: 'Số lượng bài' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number = 12;
}
