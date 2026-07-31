import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class BookingClient {
  private client: ClientProxy;

  constructor() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: 'booking_queue',
        queueOptions: { durable: false },
      },
    });
  }

  send<T>(pattern: string, data: any): Promise<T> {
    return this.client.send<T>(pattern, data).toPromise() as Promise<T>;
  }

  emit<T>(pattern: string, data: any) {
    return this.client.emit(pattern, data);
  }
}
