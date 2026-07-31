import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ModerationModule } from './moderation.module';

async function bootstrap() {
  const app = await NestFactory.create(ModerationModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
      queue: 'moderation_queue',
      queueOptions: { durable: false },
    },
  });

  await app.startAllMicroservices();
  await app.listen(parseInt(process.env.PORT || '3007', 10));
  console.log('Moderation service running on port 3007');
}
bootstrap();
