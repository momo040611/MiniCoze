import { Module } from '@nestjs/common';
import { AiGatewayController } from './ai-gateway.controller';
import { AiGatewayService } from './ai-gateway.service';
import { DynamicAiProviderFactory } from './dynamic-ai-provider.factory';

// AI Gateway 同时支持旧环境变量 Provider 和新数据库动态 Provider。
@Module({
  controllers: [AiGatewayController],
  providers: [AiGatewayService, DynamicAiProviderFactory],
  exports: [AiGatewayService, DynamicAiProviderFactory],
})
export class AiGatewayModule {}
