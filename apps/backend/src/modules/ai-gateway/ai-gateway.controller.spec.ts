import { Test, TestingModule } from '@nestjs/testing';
import { AiGatewayController } from './ai-gateway.controller';
import { AiProvider } from './types';

describe('AiGatewayController', () => {
  let controller: AiGatewayController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiGatewayController],
    }).compile();

    controller = module.get(AiGatewayController);
  });

  describe('getProviders', () => {
    it('应返回所有支持的 AI 提供商列表', () => {
      const result = controller.getProviders();

      expect(result).toEqual({
        providers: [
          AiProvider.OPENAI,
          AiProvider.DEEPSEEK,
          AiProvider.ANTHROPIC,
          AiProvider.GEMINI,
        ],
      });
    });
  });
});
