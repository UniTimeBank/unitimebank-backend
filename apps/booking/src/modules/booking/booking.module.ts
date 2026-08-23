import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CloudinaryModule } from '@app/common';
import {
  Booking,
  BookingMessage,
  BookingChatState,
  BookingReminder,
  BookingAuditLog,
} from './entities';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';

@Module({
  imports: [
    CloudinaryModule,
    TypeOrmModule.forFeature([
      Booking,
      BookingMessage,
      BookingChatState,
      BookingReminder,
      BookingAuditLog,
    ]),
    ClientsModule.register([
      {
        name: 'WALLET_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'wallet_queue',
          queueOptions: { durable: false },
        },
      },
      {
        name: 'POST_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'post_queue',
          queueOptions: { durable: false },
        },
      },
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'notification_queue',
          queueOptions: { durable: false },
        },
      },
    ]),
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
