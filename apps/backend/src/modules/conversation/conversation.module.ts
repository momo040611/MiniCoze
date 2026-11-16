/**
 * [DEPRECATED] 旧对话链路。
 *
 * 新的运行时应使用 agent-runtime 模块（agent-runtime.controller
 * 的 SSE 运行接口），本模块路由仅为兼容保留，请勿在此新增功能。
 */
import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [AiGatewayModule, WorkspaceModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
