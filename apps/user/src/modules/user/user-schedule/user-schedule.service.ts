import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { MentorRecurringSchedule, MentorExceptionDate } from '../entities';
import {
  CreateRecurringScheduleDto,
  UpdateRecurringScheduleDto,
  CreateScheduleExceptionDto,
  RecurringScheduleResponseDto,
  ScheduleExceptionResponseDto,
  DayAvailabilityDto,
  AvailabilitySlotDto,
  ExceptionType,
} from '@app/contracts/user';

import { RewardType } from '../enums';
import { UserProfileService } from '../user-profile/user-profile.service';

const DAY_OF_WEEK_MAP = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

@Injectable()
export class UserScheduleService {
  constructor(
    @InjectRepository(MentorRecurringSchedule)
    private readonly recurringRepo: Repository<MentorRecurringSchedule>,
    @InjectRepository(MentorExceptionDate)
    private readonly exceptionRepo: Repository<MentorExceptionDate>,
    private readonly userProfileService: UserProfileService,
  ) {}

  // ==================== LỊCH LẶP LẠI (RECURRING SCHEDULE) ====================

  async getRecurringSchedules(mentorId: string): Promise<{ data: RecurringScheduleResponseDto[] }> {
    const schedules = await this.recurringRepo.find({
      where: { mentorId },
      order: { createdAt: 'ASC' },
    });

    return {
      data: schedules.map((s) => this.mapRecurringToDto(s)),
    };
  }

  async createRecurringSchedule(
    mentorId: string,
    dto: CreateRecurringScheduleDto,
  ): Promise<RecurringScheduleResponseDto> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ kết thúc phải lớn hơn giờ bắt đầu');
    }

    // Kiểm tra chồng đè khung giờ
    const existing = await this.recurringRepo.find({
      where: { mentorId, dayOfWeek: dto.dayOfWeek, isActive: true },
    });

    const isOverlap = existing.some(
      (s) => dto.startTime < s.endTime && s.startTime < dto.endTime,
    );

    if (isOverlap) {
      throw new BadRequestException(
        `Khung giờ [${dto.startTime} - ${dto.endTime}] bị trùng/chồng đè với khung giờ đã có trên ${dto.dayOfWeek}`,
      );
    }

    const durationMinutes = this.calculateDurationMinutes(dto.startTime, dto.endTime);

    const schedule = new MentorRecurringSchedule();
    schedule.mentorId = mentorId;
    schedule.dayOfWeek = dto.dayOfWeek;
    schedule.startTime = dto.startTime;
    schedule.endTime = dto.endTime;
    schedule.durationMinutes = durationMinutes;
    schedule.isActive = true;

    const saved = await this.recurringRepo.save(schedule);

    // Tự động kiểm tra và trao 10 Credit thưởng tạo Lịch rảnh đầu tiên
    try {
      await this.userProfileService.checkAndRewardTask(mentorId, RewardType.PROFILE_SCHEDULE, 10);
    } catch (err) {
      console.error('[SCHEDULE] Error rewarding schedule task:', err);
    }

    return this.mapRecurringToDto(saved);
  }

  async updateRecurringSchedule(
    mentorId: string,
    scheduleId: string,
    dto: UpdateRecurringScheduleDto,
  ): Promise<RecurringScheduleResponseDto> {
    const schedule = await this.recurringRepo.findOne({
      where: { id: scheduleId, mentorId },
    });

    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch rảnh lặp lại');
    }

    if (dto.startTime !== undefined) schedule.startTime = dto.startTime;
    if (dto.endTime !== undefined) schedule.endTime = dto.endTime;
    if (dto.isActive !== undefined) schedule.isActive = dto.isActive;

    schedule.durationMinutes = this.calculateDurationMinutes(schedule.startTime, schedule.endTime);

    const saved = await this.recurringRepo.save(schedule);
    return this.mapRecurringToDto(saved);
  }

  async deleteRecurringSchedule(mentorId: string, scheduleId: string): Promise<void> {
    const schedule = await this.recurringRepo.findOne({
      where: { id: scheduleId, mentorId },
    });

    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch rảnh lặp lại');
    }

    await this.recurringRepo.remove(schedule);
  }

  // ==================== LỊCH ĐẶC BIỆT (EXCEPTIONS) ====================

  async getExceptions(
    mentorId: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<{ data: ScheduleExceptionResponseDto[] }> {
    let whereCondition: any = { mentorId };

    if (fromDate && toDate) {
      whereCondition.exceptionDate = Between(fromDate, toDate);
    } else if (fromDate) {
      whereCondition.exceptionDate = MoreThanOrEqual(fromDate);
    } else if (toDate) {
      whereCondition.exceptionDate = LessThanOrEqual(toDate);
    }

    const exceptions = await this.exceptionRepo.find({
      where: whereCondition,
      order: { exceptionDate: 'ASC', startTime: 'ASC' },
    });

    return {
      data: exceptions.map((e) => this.mapExceptionToDto(e)),
    };
  }

  async createException(
    mentorId: string,
    dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleExceptionResponseDto> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ kết thúc phải lớn hơn giờ bắt đầu');
    }

    // Kiểm tra chồng đè khung giờ ngoại lệ
    const existing = await this.exceptionRepo.find({
      where: { mentorId, exceptionDate: dto.exceptionDate },
    });

    const isOverlap = existing.some(
      (e) => dto.startTime < e.endTime && e.startTime < dto.endTime,
    );

    if (isOverlap) {
      throw new BadRequestException(
        `Lịch ngoại lệ [${dto.startTime} - ${dto.endTime}] bị trùng với lịch đã có trong ngày ${dto.exceptionDate}`,
      );
    }

    const durationMinutes = this.calculateDurationMinutes(dto.startTime, dto.endTime);

    const exception = new MentorExceptionDate();
    exception.mentorId = mentorId;
    exception.exceptionDate = dto.exceptionDate;
    exception.type = dto.type;
    exception.startTime = dto.startTime;
    exception.endTime = dto.endTime;
    exception.durationMinutes = durationMinutes;
    exception.reason = dto.reason || null;

    const saved = await this.exceptionRepo.save(exception);
    return this.mapExceptionToDto(saved);
  }

  async deleteException(mentorId: string, exceptionId: string): Promise<void> {
    const exception = await this.exceptionRepo.findOne({
      where: { id: exceptionId, mentorId },
    });

    if (!exception) {
      throw new NotFoundException('Không tìm thấy lịch đặc biệt');
    }

    await this.exceptionRepo.remove(exception);
  }

  // ==================== KHẢ DỤNG LỊCH RẢNH (AVAILABILITY) ====================

  async getAvailability(
    mentorId: string,
    fromDateStr: string,
    toDateStr: string,
  ): Promise<{ data: DayAvailabilityDto[] }> {
    const parseYMD = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    };

    const startDate = parseYMD(fromDateStr);
    const endDate = parseYMD(toDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Ngày from hoặc to không hợp lệ');
    }

    if (startDate > endDate) {
      throw new BadRequestException('Ngày from phải nhỏ hơn hoặc bằng ngày to');
    }

    const recurringList = await this.recurringRepo.find({
      where: { mentorId, isActive: true },
    });

    const exceptionList = await this.exceptionRepo.find({
      where: {
        mentorId,
        exceptionDate: Between(fromDateStr, toDateStr),
      },
    });

    const resultDays: DayAvailabilityDto[] = [];
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayOfWeekCode = DAY_OF_WEEK_MAP[curr.getUTCDay()];

      const dayRecurring = recurringList.filter((r) => r.dayOfWeek === dayOfWeekCode);
      const dayExceptions = exceptionList.filter((e) => e.exceptionDate === dateStr);

      const blockedExceptions = dayExceptions.filter((e) => e.type === ExceptionType.BLOCKED);
      const extraExceptions = dayExceptions.filter((e) => e.type === ExceptionType.EXTRA);

      const slots: AvailabilitySlotDto[] = [];

      for (const rec of dayRecurring) {
        const isBlocked = blockedExceptions.some(
          (b) => b.startTime === rec.startTime && b.endTime === rec.endTime,
        );
        if (!isBlocked) {
          slots.push({
            startTime: rec.startTime,
            endTime: rec.endTime,
            source: 'RECURRING',
            recurringScheduleId: rec.id,
          });
        }
      }

      for (const ext of extraExceptions) {
        slots.push({
          startTime: ext.startTime,
          endTime: ext.endTime,
          source: 'EXTRA',
          exceptionId: ext.id,
        });
      }

      resultDays.push({
        date: dateStr,
        dayOfWeek: dayOfWeekCode,
        slots,
      });

      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    return { data: resultDays };
  }

  // ==================== PRIVATE HELPERS ====================

  private calculateDurationMinutes(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;

    if (endTotal <= startTotal) {
      endTotal += 24 * 60;
    }

    return endTotal - startTotal;
  }

  private mapRecurringToDto(entity: MentorRecurringSchedule): RecurringScheduleResponseDto {
    return {
      id: entity.id,
      dayOfWeek: entity.dayOfWeek as any,
      startTime: entity.startTime,
      endTime: entity.endTime,
      durationMinutes: entity.durationMinutes,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
    };
  }

  private mapExceptionToDto(entity: MentorExceptionDate): ScheduleExceptionResponseDto {
    return {
      id: entity.id,
      exceptionDate: entity.exceptionDate,
      type: entity.type as any,
      startTime: entity.startTime,
      endTime: entity.endTime,
      durationMinutes: entity.durationMinutes,
      reason: entity.reason || undefined,
      createdAt: entity.createdAt,
    };
  }
}
