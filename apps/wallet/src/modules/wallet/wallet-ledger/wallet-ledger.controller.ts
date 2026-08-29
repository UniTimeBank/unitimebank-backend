import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WalletLedgerService } from './wallet-ledger.service';
import { GetWalletHistoryQueryDto } from '@app/contracts/wallet';

@Controller()
export class WalletLedgerController {
  constructor(private readonly walletLedgerService: WalletLedgerService) {}

  @MessagePattern('wallet.getHistory')
  async getHistory(
    @Payload() data: { userId: string; query: GetWalletHistoryQueryDto },
  ) {
    if (!data?.userId) return { entries: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 1 } };
    return this.walletLedgerService.getHistory(data.userId, data.query || {});
  }

  @MessagePattern('wallet.getSystemStats')
  async getSystemStats() {
    return this.walletLedgerService.getSystemFinancialStats();
  }

  @MessagePattern('wallet.getAllLedger')
  async getAllLedger(@Payload() data?: { page?: number; limit?: number }) {
    const page = data?.page || 1;
    const limit = data?.limit || 50;
    return this.walletLedgerService.getAllLedgerEntries(page, limit);
  }
}
