import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { BookingClient } from '../clients/booking.client';

@Controller('bookings')
export class BookingRoutes {
  constructor(private readonly bookingClient: BookingClient) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingClient.send('booking.findOne', { id });
  }

  @Get()
  findAll() {
    return this.bookingClient.send('booking.findAll', {});
  }

  @Post()
  create(@Body() body: any) {
    return this.bookingClient.send('booking.create', body);
  }

  @Put(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.bookingClient.send('booking.confirm', { id });
  }

  @Put(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.bookingClient.send('booking.cancel', { id });
  }
}
