import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { MentorPost, MentorPostSchema, LearnerRequest, LearnerRequestSchema } from './modules/post/schemas';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URL || 'mongodb://localhost:27017/post_db'),
    MongooseModule.forFeature([
      { name: MentorPost.name, schema: MentorPostSchema },
      { name: LearnerRequest.name, schema: LearnerRequestSchema },
    ]),
  ],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
