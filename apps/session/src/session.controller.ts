import { Controller, Get } from '@nestjs/common';
import { SessionService } from './session.service';

@Controller()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  getHello(): string {
    return this.sessionService.getHello();
  }
}
