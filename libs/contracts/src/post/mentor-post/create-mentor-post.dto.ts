import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, SkillCategoryName, PostScheduleType } from '../enums';

export class PostTagDto {
  @ApiProperty({ example: 'Spring Boot', description: 'Tên kỹ năng' })
  @IsString()
  @IsNotEmpty()
  skillName: string;

  @ApiPropertyOptional({
    enum: SkillCategoryName,
    example: SkillCategoryName.PROGRAMMING,
    description: 'Danh mục kỹ năng',
  })
  @IsEnum(SkillCategoryName)
  @IsOptional()
  category?: SkillCategoryName;
}

export class TimeSlotDto {
  @ApiProperty({ example: 'MONDAY', description: 'Thứ trong tuần' })
  @IsString()
  @IsNotEmpty()
  dayOfWeek: string;

  @ApiProperty({ example: '19:00', description: 'Thời gian bắt đầu (HH:mm)' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '21:00', description: 'Thời gian kết thúc (HH:mm)' })
  @IsString()
  @IsNotEmpty()
  endTime: string;
}

export class CreateMentorPostDto {
  @ApiProperty({
    example: 'Hướng dẫn Spring Boot Microservices từ cơ bản đến nâng cao',
    description: 'Tiêu đề bài đăng nhận dạy',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example: 'Khóa học hướng dẫn sinh viên xây dựng hệ thống kiến trúc Microservices thực chiến với Spring Boot, Docker và Kafka.',
    description: 'Mô tả chi tiết nội dung và lộ trình giảng dạy',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'Hướng dẫn xây dựng Microservices thực chiến với Spring Boot & Docker.',
    description: 'Mô tả tóm tắt hiển thị trên thẻ card',
  })
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({
    enum: SessionType,
    default: SessionType.BOTH,
    example: SessionType.BOTH,
    description: 'Hình thức lớp học (ONE_ON_ONE, GROUP, BOTH)',
  })
  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  @ApiPropertyOptional({
    enum: PostScheduleType,
    default: PostScheduleType.ALWAYS_OPEN,
    example: PostScheduleType.ALWAYS_OPEN,
    description: 'Cơ chế lịch bài đăng (ALWAYS_OPEN: Luôn mở theo tuần, LIMITED_TIME: Có thời hạn theo đợt)',
  })
  @IsEnum(PostScheduleType)
  @IsOptional()
  scheduleType?: PostScheduleType;

  @ApiPropertyOptional({
    example: '2026-08-15',
    description: 'Ngày bắt đầu khóa học/đợt ôn tập (áp dụng khi scheduleType là LIMITED_TIME)',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-30',
    description: 'Ngày kết thúc khóa học/đợt ôn tập (áp dụng khi scheduleType là LIMITED_TIME)',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    type: [PostTagDto],
    description: 'Danh sách kỹ năng kèm danh mục',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostTagDto)
  tags: PostTagDto[];

  @ApiPropertyOptional({
    type: [TimeSlotDto],
    description: 'Danh sách khung giờ rảnh nhận dạy',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  availableSlots?: TimeSlotDto[];
}
