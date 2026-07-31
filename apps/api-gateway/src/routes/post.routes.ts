import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { PostClient } from '../clients/post.client';

@Controller('posts')
export class PostRoutes {
  constructor(private readonly postClient: PostClient) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postClient.send('post.findOne', { id });
  }

  @Get()
  findAll(@Req() req: any) {
    return this.postClient.send('post.findAll', req.query);
  }

  @Post()
  create(@Body() body: any) {
    return this.postClient.send('post.create', body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.postClient.send('post.update', { id, ...body });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postClient.send('post.remove', { id });
  }
}
