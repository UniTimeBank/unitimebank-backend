import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { Role } from '@app/contracts';
import { WalletClient } from '../clients/wallet.client';
import {
  WalletResponseDto,
  GetWalletHistoryQueryDto,
  GetWalletHistoryResponseDto,
  CheckBalanceResponseDto,
} from '@app/contracts/wallet';

@ApiTags('Wallet - Ví Credit')
@Controller('wallets')
export class WalletRoutes {
  constructor(private readonly walletClient: WalletClient) {}

  /** Lấy thống kê tài chính toàn hệ thống cho Admin */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin - Thống kê tài chính, escrow & lưu thông credit' })
  getAdminStats() {
    return this.walletClient.send('wallet.getSystemStats', {});
  }

  /** Lấy toàn bộ nhật ký sổ cái hệ thống cho Admin */
  @Get('admin/ledger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin - Xem toàn bộ sổ cái giao dịch hệ thống' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAdminLedger(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.walletClient.send('wallet.getAllLedger', {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  /** Lấy thông tin ví của user hiện tại */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin ví của người dùng hiện tại' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  getMyWallet(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.walletClient.send('wallet.findOne', { userId });
  }

  /** Lấy lịch sử giao dịch sổ cái của user hiện tại */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch sử giao dịch sổ cái (lọc, phân trang)' })
  @ApiResponse({ status: 200, type: GetWalletHistoryResponseDto })
  getWalletHistory(@Req() req: any, @Query() query: GetWalletHistoryQueryDto) {
    const userId = req.user?.id || req.user?.sub;
    return this.walletClient.send('wallet.getHistory', { userId, query });
  }

  /** Kiểm tra số dư khả dụng cho việc vào phòng học */
  @Get('balance/check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kiểm tra số dư khả dụng cho việc vào phòng học' })
  @ApiResponse({ status: 200, type: CheckBalanceResponseDto })
  checkBalanceForRoom(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.walletClient.send('wallet.checkBalance', { userId });
  }

  /** Lấy thông tin ví theo userId */
  @Get(':userId')
  @ApiOperation({ summary: 'Lấy thông tin ví theo ID người dùng' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  findOne(@Param('userId') userId: string) {
    return this.walletClient.send('wallet.findOne', { userId });
  }
}
