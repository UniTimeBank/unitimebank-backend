import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserScheduleService } from './user-schedule.service';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import {
  CreateRecurringScheduleDto,
  UpdateRecurringScheduleDto,
  CreateScheduleExceptionDto,
  RecurringScheduleResponseDto,
  ScheduleExceptionResponseDto,
  GetAvailabilityResponseDto,
} from '@app/contracts/user';

@Controller('users')
export class UserScheduleController {
  constructor(private readonly scheduleService: UserScheduleService) {}

  /** Lấy danh sách lịch lặp lại của me */
  @Get('me/schedule/recurring')
  @UseGuards(JwtAuthGuard)
  async getMyRecurringSchedules(@Request() req): Promise<{ data: RecurringScheduleResponseDto[] }> {
    return this.scheduleService.getRecurringSchedules(req.user.id);
  }

  /** Tạo lịch lặp lại của me */
  @Post('me/schedule/recurring')
  @UseGuards(JwtAuthGuard)
  async createRecurringSchedule(
    @Request() req,
    @Body() dto: CreateRecurringScheduleDto,
  ): Promise<RecurringScheduleResponseDto> {
    return this.scheduleService.createRecurringSchedule(req.user.id, dto);
  }

  /** Cập nhật lịch lặp lại của me */
  @Patch('me/schedule/recurring/:scheduleId')
  @UseGuards(JwtAuthGuard)
  async updateRecurringSchedule(
    @Request() req,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateRecurringScheduleDto,
  ): Promise<RecurringScheduleResponseDto> {
    return this.scheduleService.updateRecurringSchedule(req.user.id, scheduleId, dto);
  }

  /** Xóa lịch lặp lại của me */
  @Delete('me/schedule/recurring/:scheduleId')
  @UseGuards(JwtAuthGuard)
  async deleteRecurringSchedule(
    @Request() req,
    @Param('scheduleId') scheduleId: string,
  ): Promise<void> {
    return this.scheduleService.deleteRecurringSchedule(req.user.id, scheduleId);
  }

  /** Lấy danh sách lịch đặc biệt của me */
  @Get('me/schedule/exceptions')
  @UseGuards(JwtAuthGuard)
  async getMyExceptions(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<{ data: ScheduleExceptionResponseDto[] }> {
    return this.scheduleService.getExceptions(req.user.id, from, to);
  }

  /** Tạo lịch đặc biệt của me */
  @Post('me/schedule/exceptions')
  @UseGuards(JwtAuthGuard)
  async createException(
    @Request() req,
    @Body() dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleExceptionResponseDto> {
    return this.scheduleService.createException(req.user.id, dto);
  }

  /** Xóa lịch đặc biệt của me */
  @Delete('me/schedule/exceptions/:exceptionId')
  @UseGuards(JwtAuthGuard)
  async deleteException(
    @Request() req,
    @Param('exceptionId') exceptionId: string,
  ): Promise<void> {
    return this.scheduleService.deleteException(req.user.id, exceptionId);
  }

  /** Lấy lịch rảnh khả dụng của một Mentor theo khoảng từ from -> to */
  @Get(':userId/schedule/availability')
  async getAvailability(
    @Param('userId') targetUserId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<GetAvailabilityResponseDto> {
    return this.scheduleService.getAvailability(targetUserId, from, to);
  }
}
