import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PluginExecutionService } from '../plugins/plugin-execution.service';
import { PluginModule } from '../plugins/plugin.module';
import { AgentModule } from '../single-agent/agent.module';
import { AgentRuntimeController } from './agent-runtime.controller';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentConfigFactory } from './runtime/agent-config.factory';
import { AgentRuntime } from './runtime/agent-runtime';
import { RuntimePrismaRepository } from './runtime/runtime-prisma.repository';
import { RUNTIME_REPOSITORY, TOOL_EXECUTOR } from './runtime/runtime.tokens';

@Module({
  imports: [AiGatewayModule, AgentModule, PluginModule],
  controllers: [AgentRuntimeController],
  providers: [
    AgentRuntimeService,
    AgentConfigFactory,
    AgentRuntime,
    { provide: RUNTIME_REPOSITORY, useClass: RuntimePrismaRepository },
    { provide: TOOL_EXECUTOR, useExisting: PluginExecutionService },
  ],
  exports: [AgentRuntimeService],
})
export class AgentRuntimeModule {}
