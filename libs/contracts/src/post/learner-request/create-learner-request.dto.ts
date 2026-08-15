import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, SkillCategoryName } from '../enums';

export class DesiredSlotDto {
  @ApiProperty({ example: 'WEDNESDAY', description: 'Thứ mong muốn học' })
  @IsString()
  @IsNotEmpty()
  dayOfWeek: string;

  @ApiProperty({ example: '20:00', description: 'Giờ bắt đầu dạng HH:mm (bước nhảy 15 phút: :00, :15, :30, :45)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):(00|15|30|45)$/, {
    message: 'startTime phải theo định dạng HH:mm với bước nhảy 15 phút (:00, :15, :30, :45)',
  })
  startTime: string;

  @ApiProperty({ example: '21:00', description: 'Giờ kết thúc dạng HH:mm (bước nhảy 15 phút: :00, :15, :30, :45)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):(00|15|30|45)$/, {
    message: 'endTime phải theo định dạng HH:mm với bước nhảy 15 phút (:00, :15, :30, :45)',
  })
  endTime: string;
}

export class CreateLearnerRequestDto {
  @ApiProperty({
    example: 'Giải tích 1 - Giới hạn và Đạo hàm',
    description: 'Kỹ năng / Môn học cần tìm người dạy',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  skillNeeded: string;

  @ApiProperty({
    enum: SkillCategoryName,
    example: SkillCategoryName.PROGRAMMING,
    description: 'Danh mục kỹ năng',
  })
  @IsEnum(SkillCategoryName)
  category: SkillCategoryName;

  @ApiPropertyOptional({
    example: 'Mình bị hổng kiến thức phần chuỗi số và tích phân suy rộng, cần bạn nào kèm 1:1 giải bài tập.',
    description: 'Mô tả chi tiết khó khăn và nhu cầu cần học',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'Cần tìm người hỗ trợ ôn tập Giải tích 1 trước đợt thi giữa kỳ.',
    description: 'Mô tả tóm tắt hiển thị trên thẻ card',
  })
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({
    enum: SessionType,
    default: SessionType.ONE_ON_ONE,
    example: SessionType.ONE_ON_ONE,
    description: 'Hình thức lớp học mong muốn (ONE_ON_ONE, GROUP)',
  })
  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  @ApiProperty({
    example: 60,
    description: 'Thời lượng buổi học mong muốn (tính bằng phút, bội số của 15: 30, 45, 60, 75, 90, 120...)',
  })
  @IsNumber()
  @Min(30, { message: 'Thời lượng buổi học tối thiểu là 30 phút' })
  @Type(() => Number)
  expectedDurationMinutes: number;

  @ApiPropertyOptional({
    type: [DesiredSlotDto],
    description: 'Danh sách các khung giờ mong muốn học',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DesiredSlotDto)
  desiredSlots?: DesiredSlotDto[];
}
