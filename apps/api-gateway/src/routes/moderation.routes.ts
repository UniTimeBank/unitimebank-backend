import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ModerationClient } from '../clients/moderation.client';

@Controller('moderation')
export class ModerationRoutes {
  constructor(private readonly moderationClient: ModerationClient) {}

  @Get('reports')
  getReports() {
    return this.moderationClient.send('moderation.getReports', {});
  }

  @Get('reports/:id')
  findOneReport(@Param('id') id: string) {
    return this.moderationClient.send('moderation.findOneReport', { id });
  }

  @Post('reports')
  createReport(@Body() body: any) {
    return this.moderationClient.send('moderation.createReport', body);
  }

  @Put('reports/:id/resolve')
  resolveReport(@Param('id') id: string, @Body() body: any) {
    return this.moderationClient.send('moderation.resolveReport', { id, ...body });
  }
}
