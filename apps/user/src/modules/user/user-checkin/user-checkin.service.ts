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
   * Tính số Credit phần thưởng dựa trên ngày trong chu kỳ 7 ngày (15, 5, 5, 5, 5, 5, 20)
   */
  private getRewardForStreakDay(streakDay: number): number {
    const cycleDay = ((streakDay - 1) % 7) + 1;
    switch (cycleDay) {
      case 1:
        return 15;
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
        return 5;
      case 7:
        return 20;
      default:
        return 5;
    }
  }

  /**
   * Thực hiện điểm danh hàng ngày (Tối đa 7 ngày duy nhất trong Onboarding)
   */
  async checkIn(userId: string): Promise<CheckInResponseDto> {
    const profile = await this.userProfileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Không tìm thấy hồ sơ người dùng');
    }

    const todayStr = this.getTodayString();

    // Lấy tất cả bản ghi điểm danh để kiểm tra giới hạn 7 ngày
    const countStreaks = await this.loginStreakRepo.count({ where: { userId } });
    if (countStreaks >= 7) {
      throw new ConflictException('Bạn đã hoàn thành trọn vẹn chuỗi 7 ngày điểm danh nhận thưởng.');
    }

    // Lấy bản ghi điểm danh mới nhất của user
    const lastStreak = await this.loginStreakRepo.findOne({
      where: { userId },
      order: { loginDate: 'DESC', createdAt: 'DESC' },
    });

    if (lastStreak) {
      if (lastStreak.streakDay >= 7) {
        throw new ConflictException('Bạn đã hoàn thành trọn vẹn chuỗi 7 ngày điểm danh nhận thưởng.');
      }

      const lastDateStr = this.formatDate(lastStreak.loginDate);
      if (lastDateStr === todayStr) {
        throw new ConflictException('Bạn đã điểm danh hôm nay rồi.');
      }
    }

    // Tính chuỗi streak liên tục
    let newStreak = 1;
    if (lastStreak) {
      const lastDateStr = this.formatDate(lastStreak.loginDate);
      const diffDays = this.getDiffDays(
        new Date(todayStr),
        new Date(lastDateStr),
      );

      if (diffDays === 1) {
        // Điểm danh liên tiếp ngày hôm sau
        newStreak = lastStreak.streakDay + 1;
      } else {
        // Bị đứt chuỗi (quên điểm danh quá 1 ngày) -> Reset về 1
        newStreak = 1;
      }
    }

    // Đảm bảo không vượt quá 7
    if (newStreak > 7) {
      newStreak = 7;
    }

    // Tính phần thưởng credit theo chu kỳ 7 ngày (15, 5, 5, 5, 5, 5, 20)
    const rewardCredits = this.getRewardForStreakDay(newStreak);

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
      message: newStreak === 7 ? 'Chúc mừng bạn đã hoàn thành trọn vẹn 7 ngày điểm danh nhận 60 Credit!' : 'Điểm danh thành công!',
      currentStreak: newStreak,
      rewardCredits,
      isCheckedInToday: true,
      lastCheckInDate: todayStr,
    };
  }

  /**
   * Lấy trạng thái điểm danh và chuỗi streak hiện tại (Khóa vĩnh viễn ở ngày 7 khi đã hoàn thành)
   */
  async getCheckInStatus(userId: string): Promise<GetCheckInStatusResponseDto> {
    const todayStr = this.getTodayString();

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
    const latestDateStr = this.formatDate(latest.loginDate);
    const isCheckedInToday = latestDateStr === todayStr;

    // Nếu đã hoàn thành đủ 7 ngày -> Khóa vĩnh viễn ở trạng thái hoàn thành full 7 ngày
    if (latest.streakDay >= 7 || streaks.length >= 7) {
      const history: CheckInHistoryItemDto[] = streaks.map((item) => ({
        date: this.formatDate(item.loginDate),
        streakDay: item.streakDay,
        rewardGranted: item.rewardGranted,
      }));

      return {
        currentStreak: 7,
        isCheckedInToday: true,
        lastCheckInDate: latestDateStr,
        history,
      };
    }

    // Kiểm tra xem streak có bị đứt không
    let currentStreak = latest.streakDay;
    if (!isCheckedInToday) {
      const diffDays = this.getDiffDays(new Date(todayStr), new Date(latestDateStr));
      if (diffDays > 1) {
        currentStreak = 0; // Quá 1 ngày chưa điểm danh -> reset hiển thị streak
      }
    }

    const history: CheckInHistoryItemDto[] = streaks.map((item) => ({
      date: this.formatDate(item.loginDate),
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

  /** Lấy ngày hôm nay dưới dạng YYYY-MM-DD theo giờ địa phương */
  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Format Date hoặc Date string thành dạng YYYY-MM-DD an toàn tuyệt đối */
  private formatDate(d: Date | string): string {
    if (!d) return '';
    if (typeof d === 'string') {
      const match = d.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }
    const dateObj = new Date(d);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Tính chênh lệch số ngày giữa 2 mốc thời gian */
  private getDiffDays(d1: Date, d2: Date): number {
    const timeDiff = Math.abs(d1.getTime() - d2.getTime());
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  }
}
