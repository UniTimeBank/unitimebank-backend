import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserCheckinService } from './user-checkin.service';
import {
  CheckInResponseDto,
  GetCheckInStatusResponseDto,
} from '@app/contracts/user';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';

@ApiTags('User - Daily Check-in Streak')
@Controller('users/me/check-in')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserCheckinController {
  constructor(private readonly userCheckinService: UserCheckinService) {}

  /** Thực hiện điểm danh ngày hôm nay */
  @Post()
  @ApiOperation({ summary: 'Điểm danh hàng ngày để nhận thưởng và duy trì chuỗi Streak' })
  @ApiResponse({
    status: 201,
    description: 'Điểm danh thành công',
    type: CheckInResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Bạn đã điểm danh ngày hôm nay rồi' })
  async checkIn(@Req() req: any): Promise<CheckInResponseDto> {
    return this.userCheckinService.checkIn(req.user.id);
  }

  /** Lấy trạng thái điểm danh hiện tại */
  @Get()
  @ApiOperation({ summary: 'Lấy thông tin chuỗi Streak và trạng thái điểm danh hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái điểm danh',
    type: GetCheckInStatusResponseDto,
  })
  async getCheckInStatus(@Req() req: any): Promise<GetCheckInStatusResponseDto> {
    return this.userCheckinService.getCheckInStatus(req.user.id);
  }
}
