import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingOrigin, BookingStatus } from './enums';

export class BookingResponseDto {
  @ApiProperty({ example: 'uuid-booking-12345', description: 'ID booking' })
  id: string;

  @ApiProperty({ enum: BookingOrigin, example: BookingOrigin.MENTOR_POST, description: 'Nguồn booking' })
  origin: BookingOrigin;

  @ApiPropertyOptional({ example: '66a1b2c3d4e5f67890123456', description: 'ID bài đăng gốc' })
  sourcePostId?: string;

  @ApiProperty({ example: 'user-mentor-123', description: 'ID người dạy' })
  mentorId: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn Mentor', description: 'Tên Mentor (Snapshot)' })
  mentorName?: string;

  @ApiPropertyOptional({ example: 'https://avatar.com/mentor.jpg', description: 'Ảnh đại diện Mentor (Snapshot)' })
  mentorAvatar?: string;

  @ApiProperty({ example: 'user-learner-456', description: 'ID người học' })
  learnerId: string;

  @ApiPropertyOptional({ example: 'Trần Thị Learner', description: 'Tên Learner (Snapshot)' })
  learnerName?: string;

  @ApiPropertyOptional({ example: 'https://avatar.com/learner.jpg', description: 'Ảnh đại diện Learner (Snapshot)' })
  learnerAvatar?: string;

  @ApiPropertyOptional({ example: 'Hướng dẫn Spring Boot', description: 'Tiêu đề môn học / kỹ năng' })
  title?: string;

  @ApiPropertyOptional({ example: 'Em muốn hỏi về JWT Auth', description: 'Lời nhắn kèm theo' })
  note?: string;

  @ApiProperty({ example: '2026-08-20T09:00:00.000Z', description: 'Thời gian bắt đầu' })
  scheduledStart: string;

  @ApiProperty({ example: '2026-08-20T10:00:00.000Z', description: 'Thời gian kết thúc' })
  scheduledEnd: string;

  @ApiProperty({ example: 60, description: 'Thời lượng (phút)' })
  durationMinutes: number;

  @ApiProperty({ example: 60, description: 'Số Credit tạm giữ / thanh toán' })
  totalCreditEscrowed: number;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.PENDING_MENTOR_APPROVAL, description: 'Trạng thái booking' })
  status: BookingStatus;

  @ApiPropertyOptional({ example: '2026-08-20T09:05:00.000Z', description: 'Thời gian duyệt' })
  acceptedAt?: string;

  @ApiPropertyOptional({ example: '2026-08-20T09:05:00.000Z', description: 'Thời gian hủy' })
  cancelledAt?: string;

  @ApiPropertyOptional({ example: 'Lịch bận đột xuất', description: 'Lý do từ chối / hủy' })
  cancellationReason?: string;

  @ApiProperty({ example: '2026-08-20T08:00:00.000Z', description: 'Thời gian tạo' })
  createdAt: string;
}

export class GetBookingsResponseDto {
  @ApiProperty({ type: [BookingResponseDto], description: 'Danh sách booking' })
  items: BookingResponseDto[];

  @ApiProperty({ example: 1, description: 'Tổng số bản ghi' })
  total: number;
}
