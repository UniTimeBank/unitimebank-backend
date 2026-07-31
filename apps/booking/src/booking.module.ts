import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { Booking, BookingMessage, BookingChatState, BookingReminder, BookingAuditLog } from './modules/booking/entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'booking_db',
      entities: [Booking, BookingMessage, BookingChatState, BookingReminder, BookingAuditLog],
      synchronize: true,
      ssl: process.env.DB_SSL === 'true',
      extra: process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {},
    }),
  ],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
