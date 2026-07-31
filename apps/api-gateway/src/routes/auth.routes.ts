import { Controller, Post, Body, Get, Req } from '@nestjs/common';
import { AuthClient } from '../clients/auth.client';

@Controller('auth')
export class AuthRoutes {
  constructor(private readonly authClient: AuthClient) {}

  @Post('register')
  register(@Body() body: any) {
    return this.authClient.send('auth.register', body);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authClient.send('auth.login', body);
  }

  @Post('refresh')
  refresh(@Body() body: any) {
    return this.authClient.send('auth.refresh', body);
  }

  @Post('logout')
  logout(@Body() body: any) {
    return this.authClient.send('auth.logout', body);
  }

  @Get('verify')
  verify(@Req() req: any) {
    return this.authClient.send('auth.verify', { userId: req.user?.userId });
  }
}
