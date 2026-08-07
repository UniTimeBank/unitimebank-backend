import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsBoolean, IsOptional, Matches } from 'class-validator';
import { DayOfWeek } from './schedule-enums';

export class CreateRecurringScheduleDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MON })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '19:00', description: 'Giờ bắt đầu dạng HH:mm' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime phải theo định dạng HH:mm' })
  startTime: string;

  @ApiProperty({ example: '21:00', description: 'Giờ kết thúc dạng HH:mm' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime phải theo định dạng HH:mm' })
  endTime: string;
}

export class UpdateRecurringScheduleDto {
  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  startTime?: string;

  @ApiPropertyOptional({ example: '20:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  endTime?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RecurringScheduleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: DayOfWeek })
  dayOfWeek: DayOfWeek;

  @ApiProperty({ example: '19:00' })
  startTime: string;

  @ApiProperty({ example: '21:00' })
  endTime: string;

  @ApiProperty({ example: 120 })
  durationMinutes: number;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class GetRecurringSchedulesResponseDto {
  @ApiProperty({ type: [RecurringScheduleResponseDto] })
  data: RecurringScheduleResponseDto[];
}
