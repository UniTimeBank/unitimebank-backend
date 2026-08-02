import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInResponseDto {
  @ApiProperty({ example: 'Điểm danh thành công!', description: 'Thông báo kết quả' })
  message: string;

  @ApiProperty({ example: 5, description: 'Số ngày chuỗi điểm danh hiện tại (Streak)' })
  currentStreak: number;

  @ApiProperty({ example: 1, description: 'Số điểm tín chỉ thưởng nhận được' })
  rewardCredits: number;

  @ApiProperty({ example: true, description: 'Trạng thái đã điểm danh hôm nay' })
  isCheckedInToday: boolean;

  @ApiProperty({ example: '2026-08-02', description: 'Ngày điểm danh vừa rồi (YYYY-MM-DD)' })
  lastCheckInDate: string;
}

export class CheckInHistoryItemDto {
  @ApiProperty({ example: '2026-08-02', description: 'Ngày điểm danh' })
  date: string;

  @ApiProperty({ example: 5, description: 'Số ngày streak tại thời điểm đó' })
  streakDay: number;

  @ApiProperty({ example: true, description: 'Đã nhận thưởng' })
  rewardGranted: boolean;
}

export class GetCheckInStatusResponseDto {
  @ApiProperty({ example: 5, description: 'Chuỗi điểm danh liên tục hiện tại' })
  currentStreak: number;

  @ApiProperty({ example: true, description: 'Đã điểm danh ngày hôm nay chưa' })
  isCheckedInToday: boolean;

  @ApiPropertyOptional({ example: '2026-08-02', description: 'Ngày điểm danh gần nhất' })
  lastCheckInDate: string | null;

  @ApiProperty({ type: [CheckInHistoryItemDto], description: 'Lịch sử điểm danh 7 ngày gần nhất' })
  history: CheckInHistoryItemDto[];
}
