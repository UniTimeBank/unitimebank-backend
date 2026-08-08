import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';

describe('PostController', () => {
  let postController: PostController;
  let postService: PostService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: {
            createMentorPost: jest.fn(),
            getMentorPosts: jest.fn(),
            getMentorPostById: jest.fn(),
          },
        },
      ],
    }).compile();

    postController = app.get<PostController>(PostController);
    postService = app.get<PostService>(PostService);
  });

  it('should be defined', () => {
    expect(postController).toBeDefined();
  });
});
