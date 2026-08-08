import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, SkillCategoryName, LearnerRequestStatus } from '../enums';

export class GetLearnerRequestsQueryDto {
  @ApiPropertyOptional({ example: 'Giải tích', description: 'Tìm kiếm theo từ khóa' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: SkillCategoryName, example: SkillCategoryName.PROGRAMMING, description: 'Lọc theo danh mục' })
  @IsEnum(SkillCategoryName)
  @IsOptional()
  category?: SkillCategoryName;

  @ApiPropertyOptional({ enum: SessionType, example: SessionType.ONE_ON_ONE, description: 'Lọc theo hình thức lớp' })
  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  @ApiPropertyOptional({ enum: LearnerRequestStatus, example: LearnerRequestStatus.OPEN, description: 'Lọc theo trạng thái yêu cầu' })
  @IsEnum(LearnerRequestStatus)
  @IsOptional()
  status?: LearnerRequestStatus;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Trang' })
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
