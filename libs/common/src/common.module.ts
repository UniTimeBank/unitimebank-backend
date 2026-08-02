import { Module, Global } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CommonService } from './common.service';
import { EmailService } from './email/email.service';
import { JwtStrategy } from './guards/jwt.strategy';

@Global()
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [CommonService, EmailService, JwtStrategy],
  exports: [CommonService, EmailService, PassportModule],
})
export class CommonModule {}
