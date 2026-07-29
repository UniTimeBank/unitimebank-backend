import { NestFactory } from '@nestjs/core';
import { SessionModule } from './session.module';

async function bootstrap() {
  const app = await NestFactory.create(SessionModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
