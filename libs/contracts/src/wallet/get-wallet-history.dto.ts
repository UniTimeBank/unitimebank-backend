import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum LedgerDirectionDto {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum LedgerEntryTypeDto {
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  HEARTBEAT_DEDUCT = 'HEARTBEAT_DEDUCT',
  TRIAL_REFUND = 'TRIAL_REFUND',
  CANCELLATION_REFUND = 'CANCELLATION_REFUND',
  AFK_REFUND = 'AFK_REFUND',
  ONBOARDING_REWARD = 'ONBOARDING_REWARD',
  MODERATION_REFUND = 'MODERATION_REFUND',
}

export class GetWalletHistoryQueryDto {
  @ApiPropertyOptional({ example: '2024-01-01', description: 'Thời gian bắt đầu (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2024-01-31', description: 'Thời gian kết thúc (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ enum: LedgerDirectionDto, description: 'Loại hướng giao dịch: CREDIT hoặc DEBIT' })
  @IsOptional()
  @IsEnum(LedgerDirectionDto)
  type?: LedgerDirectionDto;

  @ApiPropertyOptional({ enum: LedgerEntryTypeDto, description: 'Chi tiết loại giao dịch' })
  @IsOptional()
  @IsEnum(LedgerEntryTypeDto)
  entryType?: LedgerEntryTypeDto;

  @ApiPropertyOptional({ example: 1, description: 'Trang cần xem' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, description: 'Số lượng mục trên mỗi trang' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class CreditLedgerEntryDto {
  @ApiProperty({ example: 'uuid-string', description: 'ID giao dịch' })
  id: string;

  @ApiProperty({ enum: LedgerDirectionDto, description: 'Hướng giao dịch: CREDIT hoặc DEBIT' })
  direction: LedgerDirectionDto;

  @ApiProperty({ enum: LedgerEntryTypeDto, description: 'Loại giao dịch' })
  entryType: LedgerEntryTypeDto;

  @ApiProperty({ example: 1, description: 'Số credit giao dịch' })
  amount: number;

  @ApiProperty({ example: 149, description: 'Số dư khả dụng sau giao dịch' })
  balanceAfter: number;

  @ApiProperty({ example: 'reference-uuid', description: 'ID tham chiếu (Booking ID / Room ID / Event ID)' })
  referenceId: string;

  @ApiProperty({ example: 'SESSION_ROOM', description: 'Loại tham chiếu (BOOKING, SESSION_ROOM, REWARD, ...)' })
  referenceKind: string;

  @ApiProperty({ example: '2024-01-15T18:01:00Z', description: 'Thời điểm tạo giao dịch' })
  createdAt: Date;
}

export class GetWalletHistoryResponseDto {
  @ApiProperty({ type: [CreditLedgerEntryDto], description: 'Danh sách nhật ký giao dịch' })
  entries: CreditLedgerEntryDto[];

  @ApiProperty({
    example: { total: 100, page: 1, limit: 50, totalPages: 2 },
    description: 'Thông tin phân trang',
  })
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
