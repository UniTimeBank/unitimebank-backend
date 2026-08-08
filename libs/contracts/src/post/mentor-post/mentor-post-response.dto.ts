import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionType, PostStatus } from '../enums';
import { PostTagDto, TimeSlotDto } from './create-mentor-post.dto';

export class MentorPostResponseDto {
  @ApiProperty({ example: '66a1b2c3d4e5f67890123456', description: 'ID bài đăng' })
  _id: string;

  @ApiProperty({ example: 'user-123456', description: 'ID người dạy (Mentor)' })
  mentorId: string;

  @ApiPropertyOptional({ example: 'Nguyễn Hoàng Sang', description: 'Tên mentor (Snapshot)' })
  mentorName?: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
    description: 'Ảnh đại diện mentor (Snapshot)',
  })
  mentorAvatar?: string;

  @ApiProperty({ example: 'Hướng dẫn Spring Boot Microservices từ cơ bản', description: 'Tiêu đề' })
  title: string;

  @ApiPropertyOptional({ example: 'Lộ trình học thực chiến...', description: 'Mô tả chi tiết' })
  description?: string;

  @ApiProperty({ enum: SessionType, example: SessionType.BOTH, description: 'Hình thức lớp học' })
  sessionType: SessionType;

  @ApiProperty({ type: [PostTagDto], description: 'Danh sách kỹ năng' })
  tags: PostTagDto[];

  @ApiProperty({ type: [TimeSlotDto], description: 'Lịch rảnh nhận dạy' })
  availableSlots: TimeSlotDto[];

  @ApiProperty({ example: 98, description: 'Điểm uy tín của Mentor tại thời điểm đăng' })
  trustScoreSnapshot: number;

  @ApiProperty({ enum: PostStatus, example: PostStatus.PUBLISHED, description: 'Trạng thái bài đăng' })
  status: PostStatus;

  @ApiProperty({ example: '2026-08-08T15:00:00.000Z', description: 'Thời gian tạo' })
  createdAt: string;

  @ApiProperty({ example: '2026-08-08T15:00:00.000Z', description: 'Thời gian cập nhật' })
  updatedAt: string;
}

export class GetMentorPostsResponseDto {
  @ApiProperty({ type: [MentorPostResponseDto], description: 'Danh sách bài đăng của Mentor' })
  items: MentorPostResponseDto[];

  @ApiProperty({ example: 25, description: 'Tổng số bài đăng thỏa mãn điều kiện' })
  total: number;

  @ApiProperty({ example: 1, description: 'Trang hiện tại' })
  page: number;

  @ApiProperty({ example: 10, description: 'Số lượng bài mỗi trang' })
  limit: number;

  @ApiProperty({ example: 3, description: 'Tổng số trang' })
  totalPages: number;
}
