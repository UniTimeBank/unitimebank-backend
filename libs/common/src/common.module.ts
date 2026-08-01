import { Module, Global } from '@nestjs/common';
import { CommonService } from './common.service';
import { EmailService } from './email/email.service';

@Global()
@Module({
  providers: [CommonService, EmailService],
  exports: [CommonService, EmailService],
})
export class CommonModule {}
