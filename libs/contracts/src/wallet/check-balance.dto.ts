import { ApiProperty } from '@nestjs/swagger';

export class CheckBalanceResponseDto {
  @ApiProperty({ example: 150, description: 'Số dư khả dụng hiện tại' })
  availableBalance: number;

  @ApiProperty({ example: true, description: 'Có đủ điều kiện tham gia phòng học không' })
  canJoinRoom: boolean;

  @ApiProperty({ example: 5, description: 'Số credit tối thiểu yêu cầu để tham gia phòng' })
  minRequired: number;

  @ApiProperty({ example: 150, description: 'Số phút học ước tính có thể duy trì' })
  estimatedMinutes: number;
}
