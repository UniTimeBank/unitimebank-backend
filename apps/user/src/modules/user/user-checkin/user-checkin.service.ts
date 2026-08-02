import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { LoginStreak } from '../entities/login-streak.entity';
import { UserProfile } from '../entities/user-profile.entity';
import {
  CheckInResponseDto,
  GetCheckInStatusResponseDto,
  CheckInHistoryItemDto,
} from '@app/contracts/user';
import { USER_EVENTS } from '@app/contracts/events';

@Injectable()
export class UserCheckinService {
  private readonly logger = new Logger(UserCheckinService.name);

  constructor(
    @InjectRepository(LoginStreak)
    private readonly loginStreakRepo: Repository<LoginStreak>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
    @Inject('WALLET_SERVICE')
    private readonly walletClient: ClientProxy,
  ) {}

  /**
   * Thực hiện điểm danh hàng ngày
   */
  async checkIn(userId: string): Promise<CheckInResponseDto> {
    const profile = await this.userProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ người dùng');
    }

    const todayStr = this.formatDate(new Date());

    // Lấy bản ghi điểm danh mới nhất của user
    const lastStreak = await this.loginStreakRepo.findOne({
      where: { userId },
      order: { loginDate: 'DESC', createdAt: 'DESC' },
    });

    if (lastStreak) {
      const lastDateStr = this.formatDate(new Date(lastStreak.loginDate));
      if (lastDateStr === todayStr) {
        throw new ConflictException('Bạn đã điểm danh ngày hôm nay rồi!');
      }
    }

    // Tính chuỗi streak liên tục
    let newStreak = 1;
    if (lastStreak) {
      const diffDays = this.getDiffDays(
        new Date(todayStr),
        new Date(this.formatDate(new Date(lastStreak.loginDate))),
      );

      if (diffDays === 1) {
        // Điểm danh liên tiếp ngày hôm sau
        newStreak = lastStreak.streakDay + 1;
      } else {
        // Bị đứt chuỗi (quên điểm danh quá 1 ngày) -> Reset về 1
        newStreak = 1;
      }
    }

    // Tính phần thưởng credit
    let rewardCredits = 1; // Thưởng cơ bản 1 credit
    if (newStreak % 30 === 0) {
      rewardCredits += 20; // Thưởng mốc 30 ngày
    } else if (newStreak % 7 === 0) {
      rewardCredits += 5; // Thưởng mốc 7 ngày
    }

    const newRecord = this.loginStreakRepo.create({
      userId,
      loginDate: new Date(todayStr),
      streakDay: newStreak,
      rewardGranted: true,
    });

    await this.loginStreakRepo.save(newRecord);

    // Gửi sự kiện RabbitMQ sang wallet_service để tự động cộng credit thưởng vào Ví
    try {
      this.walletClient.emit(USER_EVENTS.USER_CHECKIN_STREAK, {
        eventType: 'USER_CHECKIN_STREAK',
        userId,
        streakDay: newStreak,
        rewardCredits,
        timestamp: new Date().toISOString(),
      });
      this.logger.log(
        `Emitted ${USER_EVENTS.USER_CHECKIN_STREAK} event for user ${userId} (+${rewardCredits} credits)`,
      );
    } catch (err) {
      this.logger.warn(
        `Không thể gửi sự kiện RabbitMQ ${USER_EVENTS.USER_CHECKIN_STREAK}:`,
        err,
      );
    }

    return {
      message: 'Điểm danh thành công!',
      currentStreak: newStreak,
      rewardCredits,
      isCheckedInToday: true,
      lastCheckInDate: todayStr,
    };
  }

  /**
   * Lấy trạng thái điểm danh và chuỗi streak hiện tại
   */
  async getCheckInStatus(userId: string): Promise<GetCheckInStatusResponseDto> {
    const todayStr = this.formatDate(new Date());

    const streaks = await this.loginStreakRepo.find({
      where: { userId },
      order: { loginDate: 'DESC', createdAt: 'DESC' },
      take: 7,
    });

    if (streaks.length === 0) {
      return {
        currentStreak: 0,
        isCheckedInToday: false,
        lastCheckInDate: null,
        history: [],
      };
    }

    const latest = streaks[0];
    const latestDateStr = this.formatDate(new Date(latest.loginDate));
    const isCheckedInToday = latestDateStr === todayStr;

    // Kiểm tra xem streak có bị đứt không
    let currentStreak = latest.streakDay;
    if (!isCheckedInToday) {
      const diffDays = this.getDiffDays(new Date(todayStr), new Date(latestDateStr));
      if (diffDays > 1) {
        currentStreak = 0; // Quá 1 ngày chưa điểm danh -> reset hiển thị streak
      }
    }

    const history: CheckInHistoryItemDto[] = streaks.map((item) => ({
      date: this.formatDate(new Date(item.loginDate)),
      streakDay: item.streakDay,
      rewardGranted: item.rewardGranted,
    }));

    return {
      currentStreak,
      isCheckedInToday,
      lastCheckInDate: latestDateStr,
      history,
    };
  }

  /** Format Date thành dạng YYYY-MM-DD */
  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Tính chênh lệch số ngày giữa 2 mốc thời gian */
  private getDiffDays(d1: Date, d2: Date): number {
    const timeDiff = Math.abs(d1.getTime() - d2.getTime());
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  }
}
