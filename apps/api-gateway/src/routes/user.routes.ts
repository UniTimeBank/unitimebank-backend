import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { UserClient } from '../clients/user.client';

@Controller('users')
export class UserRoutes {
  constructor(private readonly userClient: UserClient) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userClient.send('user.findOne', { id });
  }

  @Get()
  findAll() {
    return this.userClient.send('user.findAll', {});
  }

  @Post()
  create(@Body() body: any) {
    return this.userClient.send('user.create', body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.userClient.send('user.update', { id, ...body });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userClient.send('user.remove', { id });
  }
}
