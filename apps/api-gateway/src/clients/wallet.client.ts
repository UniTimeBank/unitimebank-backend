import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class WalletClient {
  private client: ClientProxy;

  constructor() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: 'wallet_queue',
        queueOptions: { durable: false },
      },
    });
  }

  send<T>(pattern: string, data: any): Promise<T> {
    return firstValueFrom(this.client.send<T>(pattern, data).pipe(timeout(10000)));
  }

  emit<T>(pattern: string, data: any) {
    return this.client.emit(pattern, data);
  }
}
