import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, Matches } from 'class-validator';
import { ExceptionType } from './schedule-enums';

export class CreateScheduleExceptionDto {
  @ApiProperty({ example: '2026-08-10', description: 'Ngày áp dụng YYYY-MM-DD' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'exceptionDate phải có dạng YYYY-MM-DD' })
  exceptionDate: string;

  @ApiProperty({ enum: ExceptionType, example: ExceptionType.EXTRA })
  @IsEnum(ExceptionType)
  type: ExceptionType;

  @ApiProperty({ example: '14:00', description: 'Giờ bắt đầu (bước nhảy 15 phút: :00, :15, :30, :45)' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):(00|15|30|45)$/, { message: 'startTime phải theo định dạng HH:mm với bước nhảy 15 phút (:00, :15, :30, :45)' })
  startTime: string;

  @ApiProperty({ example: '16:00', description: 'Giờ kết thúc (bước nhảy 15 phút: :00, :15, :30, :45)' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):(00|15|30|45)$/, { message: 'endTime phải theo định dạng HH:mm với bước nhảy 15 phút (:00, :15, :30, :45)' })
  endTime: string;

  @ApiPropertyOptional({ example: 'Buổi học bổ sung' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ScheduleExceptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2026-08-10' })
  exceptionDate: string;

  @ApiProperty({ enum: ExceptionType })
  type: ExceptionType;

  @ApiProperty({ example: '14:00' })
  startTime: string;

  @ApiProperty({ example: '16:00' })
  endTime: string;

  @ApiProperty({ example: 120 })
  durationMinutes: number;

  @ApiPropertyOptional({ example: 'Buổi học bổ sung' })
  reason?: string;

  @ApiProperty()
  createdAt: Date;
}

export class GetScheduleExceptionsResponseDto {
  @ApiProperty({ type: [ScheduleExceptionResponseDto] })
  data: ScheduleExceptionResponseDto[];
}
