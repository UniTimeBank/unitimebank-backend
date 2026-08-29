import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { WalletAccountService } from './wallet-account.service';

@Controller()
export class WalletAccountController {
  constructor(private readonly walletAccountService: WalletAccountService) {}

  @EventPattern('user.registered')
  @MessagePattern('user.registered')
  async handleUserRegistered(@Payload() data: { userId: string; email?: string }) {
    if (!data?.userId) return;
    console.log(`[WALLET SERVICE] Auto creating wallet for newly registered userId: ${data.userId}`);
    return this.walletAccountService.findOrCreateWallet(data.userId);
  }

  @MessagePattern('wallet.findOne')
  @MessagePattern('wallet.getWallet')
  async findOne(@Payload() data: { userId: string }) {
    if (!data?.userId) return null;
    return this.walletAccountService.getWalletResponse(data.userId);
  }

  @MessagePattern('wallet.checkBalance')
  async checkBalance(@Payload() data: { userId: string }) {
    if (!data?.userId) return null;
    return this.walletAccountService.checkBalanceForRoom(data.userId);
  }
}
