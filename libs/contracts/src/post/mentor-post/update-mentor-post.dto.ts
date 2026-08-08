import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, PostStatus } from '../enums';
import { PostTagDto, TimeSlotDto } from './create-mentor-post.dto';

export class UpdateMentorPostDto {
  @ApiPropertyOptional({
    example: 'Hướng dẫn Spring Boot Microservices từ cơ bản (Cập nhật)',
    description: 'Tiêu đề bài đăng nhận dạy',
  })
  @IsString()
  @IsOptional()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'Cập nhật lộ trình học kèm Docker Compose và Kubernetes.',
    description: 'Mô tả chi tiết nội dung',
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
    type: [PostTagDto],
    description: 'Danh sách kỹ năng kèm danh mục',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PostTagDto)
  tags?: PostTagDto[];

  @ApiPropertyOptional({
    type: [TimeSlotDto],
    description: 'Danh sách khung giờ rảnh nhận dạy',
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  availableSlots?: TimeSlotDto[];

  @ApiPropertyOptional({
    enum: PostStatus,
    example: PostStatus.PUBLISHED,
    description: 'Trạng thái bài đăng',
  })
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;
}
