import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

describe('SessionController', () => {
  let sessionController: SessionController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [SessionService],
    }).compile();

    sessionController = app.get<SessionController>(SessionController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(sessionController.getHello()).toBe('Hello World!');
    });
  });
});
