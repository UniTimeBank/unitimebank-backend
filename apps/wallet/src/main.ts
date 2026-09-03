import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { types } from 'pg';
import { WalletModule } from './wallet.module';

// Đảm bảo timestamp without time zone (OID 1114) từ PostgreSQL luôn được parse chuẩn UTC
types.setTypeParser(1114, (str: string) => new Date(str.replace(' ', 'T') + 'Z'));

async function bootstrap() {
  const app = await NestFactory.create(WalletModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
      queue: 'wallet_queue',
      queueOptions: { durable: false },
    },
  });

  await app.startAllMicroservices();
  await app.listen(parseInt(process.env.PORT || '3006', 10));
  console.log('Wallet service running on port 3006');
}
bootstrap();
