import { ApiProperty } from '@nestjs/swagger';

export class OnboardingTaskItemDto {
  @ApiProperty({ example: 'PROFILE_COMPLETE', description: 'Mã nhiệm vụ' })
  taskKey: string;

  @ApiProperty({ example: 'Hoàn thành thông tin cơ bản', description: 'Tên nhiệm vụ' })
  title: string;

  @ApiProperty({ example: 'Cập nhật ảnh đại diện và tiểu sử', description: 'Mô tả nhiệm vụ' })
  description: string;

  @ApiProperty({ example: 10, description: 'Số credit phần thưởng' })
  rewardCredits: number;

  @ApiProperty({ example: true, description: 'Đã hoàn thành và nhận thưởng chưa' })
  completed: boolean;
}

export class GetOnboardingTasksResponseDto {
  @ApiProperty({ example: true, description: 'Nhiệm vụ 1: Hoàn thành thông tin cá nhân (10 credit)' })
  profileCompleted: boolean;

  @ApiProperty({ example: false, description: 'Nhiệm vụ 2: Tạo lịch rảnh khả dụng (10 credit)' })
  scheduleCreated: boolean;

  @ApiProperty({ example: true, description: 'Nhiệm vụ 3: Tạo kỹ năng chuyên môn (10 credit)' })
  skillAdded: boolean;

  @ApiProperty({ example: 20, description: 'Tổng số credit đã nhận từ 3 nhiệm vụ khởi tạo' })
  totalBonusEarned: number;

  @ApiProperty({ type: [OnboardingTaskItemDto], description: 'Danh sách chi tiết 3 nhiệm vụ khởi tạo' })
  tasks: OnboardingTaskItemDto[];
}
