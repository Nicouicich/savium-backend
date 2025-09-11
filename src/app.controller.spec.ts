import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {AppController} from './app.controller';
import {AppService} from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'app.nodeEnv': 'test'
              };
              return config[key];
            })
          }
        }
      ]
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return welcome message', () => {
      expect(appController.getHello()).toBe('Welcome to Savium AI Backend!');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const health = appController.getHealth();

      expect(health).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: 'test',
        version: '1.0.0'
      });
    });
  });
});
