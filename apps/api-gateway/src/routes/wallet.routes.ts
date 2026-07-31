import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { WalletClient } from '../clients/wallet.client';

@Controller('wallets')
export class WalletRoutes {
  constructor(private readonly walletClient: WalletClient) {}

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.walletClient.send('wallet.findOne', { userId });
  }

  @Post('deposit')
  deposit(@Body() body: any) {
    return this.walletClient.send('wallet.deposit', body);
  }

  @Post('withdraw')
  withdraw(@Body() body: any) {
    return this.walletClient.send('wallet.withdraw', body);
  }

  @Get(':userId/transactions')
  getTransactions(@Param('userId') userId: string) {
    return this.walletClient.send('wallet.getTransactions', { userId });
  }
}
