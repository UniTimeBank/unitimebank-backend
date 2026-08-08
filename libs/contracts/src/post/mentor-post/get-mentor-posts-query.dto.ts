import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, SkillCategoryName, PostStatus } from '../enums';

export class GetMentorPostsQueryDto {
  @ApiPropertyOptional({ example: 'Spring Boot', description: 'Tìm theo từ khóa (tiêu đề, kỹ năng, mô tả)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 'Spring Boot', description: 'Lọc theo tên kỹ năng' })
  @IsString()
  @IsOptional()
  skill?: string;

  @ApiPropertyOptional({ enum: SkillCategoryName, example: SkillCategoryName.PROGRAMMING, description: 'Lọc theo danh mục' })
  @IsEnum(SkillCategoryName)
  @IsOptional()
  category?: SkillCategoryName;

  @ApiPropertyOptional({ enum: SessionType, example: SessionType.ONE_ON_ONE, description: 'Lọc theo hình thức lớp' })
  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  @ApiPropertyOptional({ example: 90, description: 'Lọc Mentor có điểm uy tín tối thiểu' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  trustScoreMin?: number;

  @ApiPropertyOptional({ example: 'MONDAY', description: 'Lọc theo thứ trong tuần rảnh' })
  @IsString()
  @IsOptional()
  dayOfWeek?: string;

  @ApiPropertyOptional({ enum: PostStatus, example: PostStatus.PUBLISHED, description: 'Lọc theo trạng thái bài đăng' })
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Trang cần lấy' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Số lượng bài mỗi trang' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
