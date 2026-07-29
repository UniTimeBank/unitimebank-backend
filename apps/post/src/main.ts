import { NestFactory } from '@nestjs/core';
import { PostModule } from './post.module';

async function bootstrap() {
  const app = await NestFactory.create(PostModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
