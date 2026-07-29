import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionService {
  getHello(): string {
    return 'Hello World!';
  }
}
