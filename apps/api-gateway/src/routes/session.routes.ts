import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { SessionClient } from '../clients/session.client';

@Controller('sessions')
export class SessionRoutes {
  constructor(private readonly sessionClient: SessionClient) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionClient.send('session.findOne', { id });
  }

  @Get()
  findAll() {
    return this.sessionClient.send('session.findAll', {});
  }

  @Post()
  create(@Body() body: any) {
    return this.sessionClient.send('session.create', body);
  }

  @Put(':id/start')
  start(@Param('id') id: string) {
    return this.sessionClient.send('session.start', { id });
  }

  @Put(':id/complete')
  complete(@Param('id') id: string) {
    return this.sessionClient.send('session.complete', { id });
  }
}
