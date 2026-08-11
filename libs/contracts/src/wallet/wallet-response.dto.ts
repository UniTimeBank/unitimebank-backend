import { ApiProperty } from '@nestjs/swagger';

export class WalletResponseDto {
  @ApiProperty({ example: 'uuid-string', description: 'ID ví' })
  id: string;

  @ApiProperty({ example: 'user-uuid-string', description: 'ID người dùng' })
  userId: string;

  @ApiProperty({ example: 150, description: 'Số dư khả dụng (Credit)' })
  availableBalance: number;

  @ApiProperty({ example: 60, description: 'Số dư đang ký quỹ (Credit)' })
  escrowedBalance: number;

  @ApiProperty({ example: 5, description: 'Ngưỡng cảnh báo số dư thấp' })
  lowBalanceThreshold: number;

  @ApiProperty({ example: 500, description: 'Tổng số credit đã nhận được' })
  totalEarned: number;

  @ApiProperty({ example: 350, description: 'Tổng số credit đã tiêu' })
  totalSpent: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Thời điểm tạo ví' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T00:00:00.000Z', description: 'Thời điểm cập nhật' })
  updatedAt: Date;
}
