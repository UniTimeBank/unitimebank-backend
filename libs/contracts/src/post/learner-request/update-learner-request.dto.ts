import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, SkillCategoryName, LearnerRequestStatus } from '../enums';
import { DesiredSlotDto } from './create-learner-request.dto';

export class UpdateLearnerRequestDto {
  @ApiPropertyOptional({
    example: 'Giải tích 1 - Ôn tập chuẩn bị thi cuối kỳ',
    description: 'Kỹ năng / Môn học cần tìm người dạy',
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  skillNeeded?: string;

  @ApiPropertyOptional({
    enum: SkillCategoryName,
    example: SkillCategoryName.PROGRAMMING,
    description: 'Danh mục kỹ năng',
  })
  @IsEnum(SkillCategoryName)
  @IsOptional()
  category?: SkillCategoryName;

  @ApiPropertyOptional({
    example: 'Cập nhật thêm phần giải bài tập tích phân.',
    description: 'Mô tả chi tiết',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: SessionType,
    example: SessionType.ONE_ON_ONE,
    description: 'Hình thức lớp học',
  })
  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  @ApiPropertyOptional({
    example: 60,
    description: 'Thời lượng buổi học mong muốn (phút)',
  })
  @IsNumber()
  @IsOptional()
  @Min(5)
  @Type(() => Number)
  expectedDurationMinutes?: number;

  @ApiPropertyOptional({
    type: [DesiredSlotDto],
    description: 'Danh sách các khung giờ mong muốn học',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DesiredSlotDto)
  desiredSlots?: DesiredSlotDto[];

  @ApiPropertyOptional({
    enum: LearnerRequestStatus,
    example: LearnerRequestStatus.OPEN,
    description: 'Trạng thái yêu cầu (OPEN, MATCHED, CANCELLED)',
  })
  @IsEnum(LearnerRequestStatus)
  @IsOptional()
  status?: LearnerRequestStatus;
}
