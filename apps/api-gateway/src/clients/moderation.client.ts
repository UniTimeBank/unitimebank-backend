import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class ModerationClient {
  private readonly logger = new Logger(ModerationClient.name);
  private client: ClientProxy;

  constructor() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: 'moderation_queue',
        queueOptions: { durable: false },
      },
    });
  }

  async send<T>(pattern: string, data: any): Promise<T> {
    try {
      return await firstValueFrom(this.client.send<T>(pattern, data).pipe(timeout(10000)));
    } catch (err: any) {
      this.logger.error(`Error sending RMQ pattern "${pattern}":`, err);
      const message =
        err?.message ||
        err?.error ||
        (typeof err === 'string' ? err : 'Lỗi xử lý kiểm duyệt / đánh giá');
      const status =
        typeof err?.status === 'number'
          ? err.status
          : typeof err?.statusCode === 'number'
          ? err.statusCode
          : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }

  emit<T>(pattern: string, data: any) {
    return this.client.emit(pattern, data);
  }
}
