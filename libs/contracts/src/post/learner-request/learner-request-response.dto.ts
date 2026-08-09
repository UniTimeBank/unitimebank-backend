import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionType, SkillCategoryName, LearnerRequestStatus } from '../enums';
import { DesiredSlotDto } from './create-learner-request.dto';

export class LearnerRequestResponseDto {
  @ApiProperty({ example: '66a1b2c3d4e5f67890123499', description: 'ID yêu cầu' })
  _id: string;

  @ApiProperty({ example: 'user-789012', description: 'ID người học (Learner)' })
  learnerId: string;

  @ApiPropertyOptional({ example: 'Trần Thị Thu Thảo', description: 'Tên người học (Snapshot)' })
  learnerName?: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
    description: 'Ảnh đại diện người học (Snapshot)',
  })
  learnerAvatar?: string;

  @ApiProperty({ example: 'Giải tích 1', description: 'Kỹ năng cần học' })
  skillNeeded: string;

  @ApiProperty({ enum: SkillCategoryName, example: SkillCategoryName.PROGRAMMING, description: 'Danh mục' })
  category: SkillCategoryName;

  @ApiPropertyOptional({ example: 'Cần bạn nào kèm 1:1 phần chuỗi số...', description: 'Mô tả nhu cầu' })
  description?: string;

  @ApiPropertyOptional({ example: 'Tóm tắt nhu cầu...', description: 'Mô tả tóm tắt trên thẻ card' })
  shortDescription?: string;

  @ApiProperty({ enum: SessionType, example: SessionType.ONE_ON_ONE, description: 'Hình thức lớp' })
  sessionType: SessionType;

  @ApiProperty({ example: 60, description: 'Thời lượng mong muốn (phút)' })
  expectedDurationMinutes: number;

  @ApiProperty({ example: 60, description: 'Số Credit sẵn sàng chi trả (1 phút = 1 Credit)' })
  expectedCreditAmount: number;

  @ApiProperty({ type: [DesiredSlotDto], description: 'Khung giờ mong muốn học' })
  desiredSlots: DesiredSlotDto[];

  @ApiProperty({ enum: LearnerRequestStatus, example: LearnerRequestStatus.OPEN, description: 'Trạng thái yêu cầu' })
  status: LearnerRequestStatus;

  @ApiProperty({ example: '2026-08-08T15:00:00.000Z', description: 'Thời gian tạo' })
  createdAt: string;

  @ApiProperty({ example: '2026-08-08T15:00:00.000Z', description: 'Thời gian cập nhật' })
  updatedAt: string;
}

export class GetLearnerRequestsResponseDto {
  @ApiProperty({ type: [LearnerRequestResponseDto], description: 'Danh sách bài tìm người dạy' })
  items: LearnerRequestResponseDto[];

  @ApiProperty({ example: 15, description: 'Tổng số yêu cầu thỏa mãn điều kiện' })
  total: number;

  @ApiProperty({ example: 1, description: 'Trang hiện tại' })
  page: number;

  @ApiProperty({ example: 10, description: 'Số lượng bài mỗi trang' })
  limit: number;

  @ApiProperty({ example: 2, description: 'Tổng số trang' })
  totalPages: number;
}
