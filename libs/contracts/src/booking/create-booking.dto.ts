import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateMentorPostBookingDto {
  @ApiProperty({ example: '66a1b2c3d4e5f67890123456', description: 'ID bài đăng của Mentor' })
  @IsString()
  @IsNotEmpty()
  mentorPostId: string;

  @ApiProperty({ example: '2026-08-20T09:00:00.000Z', description: 'Thời gian bắt đầu buổi học' })
  @IsString()
  @IsNotEmpty()
  scheduledStart: string;

  @ApiProperty({ example: '2026-08-20T10:00:00.000Z', description: 'Thời gian kết thúc buổi học' })
  @IsString()
  @IsNotEmpty()
  scheduledEnd: string;

  @ApiPropertyOptional({ example: 60, description: 'Thời lượng (phút)' })
  @IsNumber()
  @Min(15)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'Em muốn hỏi kỹ phần microservices auth', description: 'Lời nhắn gửi Mentor' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ example: 'Em muốn hỏi kỹ phần microservices auth', description: 'Lời nhắn gửi Mentor (Alias cho note)' })
  @IsString()
  @IsOptional()
  message?: string;
}

export class CreateLearnerRequestBookingDto {
  @ApiProperty({ example: '66a1b2c3d4e5f67890123499', description: 'ID bài đăng Yêu cầu của Learner' })
  @IsString()
  @IsNotEmpty()
  learnerRequestId: string;

  @ApiProperty({ example: '2026-08-20T09:00:00.000Z', description: 'Thời gian bắt đầu buổi học' })
  @IsString()
  @IsNotEmpty()
  scheduledStart: string;

  @ApiProperty({ example: '2026-08-20T10:00:00.000Z', description: 'Thời gian kết thúc buổi học' })
  @IsString()
  @IsNotEmpty()
  scheduledEnd: string;

  @ApiPropertyOptional({ example: 60, description: 'Thời lượng (phút)' })
  @IsNumber()
  @Min(15)
  @IsOptional()
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'Mình có kinh nghiệm 3 năm Spring Boot sẵn sàng hướng dẫn bạn', description: 'Lời nhắn đề nghị của Mentor' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ example: 'Mình có kinh nghiệm 3 năm Spring Boot sẵn sàng hướng dẫn bạn', description: 'Lời nhắn đề nghị (Alias cho note)' })
  @IsString()
  @IsOptional()
  message?: string;
}

export class RespondBookingDto {
  @ApiProperty({ enum: ['ACCEPT', 'REJECT'], example: 'ACCEPT', description: 'Hành động duyệt (ACCEPT hoặc REJECT)' })
  @IsString()
  @IsNotEmpty()
  action: 'ACCEPT' | 'REJECT';

  @ApiPropertyOptional({ example: 'Lịch bận đột xuất', description: 'Lý do từ chối (nếu có)' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RejectBookingDto {
  @ApiPropertyOptional({ example: 'Lịch bận đột xuất', description: 'Lý do từ chối' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class GetBookingsQueryDto {
  @ApiPropertyOptional({ enum: ['AS_LEARNER', 'AS_MENTOR', 'ALL'], example: 'ALL', description: 'Vai trò xem danh sách' })
  @IsOptional()
  role?: 'AS_LEARNER' | 'AS_MENTOR' | 'ALL';

  @ApiPropertyOptional({ example: 'CONFIRMED', description: 'Lọc theo trạng thái' })
  @IsOptional()
  status?: string;
}
