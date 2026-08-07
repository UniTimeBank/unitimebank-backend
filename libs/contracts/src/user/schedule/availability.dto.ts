import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class GetAvailabilityQueryDto {
  @ApiProperty({ example: '2026-08-01', description: 'Từ ngày (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;

  @ApiProperty({ example: '2026-08-31', description: 'Đến ngày (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;
}

export class AvailabilitySlotDto {
  @ApiProperty({ example: '19:00' })
  startTime: string;

  @ApiProperty({ example: '21:00' })
  endTime: string;

  @ApiProperty({ example: 'RECURRING', enum: ['RECURRING', 'EXTRA'] })
  source: 'RECURRING' | 'EXTRA';

  @ApiPropertyOptional()
  recurringScheduleId?: string;

  @ApiPropertyOptional()
  exceptionId?: string;
}

export class DayAvailabilityDto {
  @ApiProperty({ example: '2026-08-10' })
  date: string;

  @ApiProperty({ example: 'MON' })
  dayOfWeek: string;

  @ApiProperty({ type: [AvailabilitySlotDto] })
  slots: AvailabilitySlotDto[];
}

export class GetAvailabilityResponseDto {
  @ApiProperty({ type: [DayAvailabilityDto] })
  data: DayAvailabilityDto[];
}
