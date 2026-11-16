import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { FileModule } from '../file/file.module';
import { PluginModule } from '../plugins/plugin.module';
import { AgentModule } from '../single-agent/agent.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AgentRunService } from './agent-run.service';
import { AgentRuntimeController } from './agent-runtime.controller';
import { AgentRuntimeService } from './agent-runtime.service';
import { RunControlService } from './run-control.service';
import { AgentConfigFactory } from './runtime/agent-config.factory';
import { AgentRuntime } from './runtime/agent-runtime';
import { ConversationMemoryService } from './runtime/conversation-memory.service';
import { RuntimeAttachmentService } from './runtime/runtime-attachment.service';
import { RuntimeKnowledgeService } from './runtime/runtime-knowledge.service';
import { RuntimePrismaRepository } from './runtime/runtime-prisma.repository';
import { RuntimeSettingsService } from './runtime/runtime-settings.service';
import { RuntimeToolExecutionService } from './runtime/runtime-tool-execution.service';
import { RUNTIME_REPOSITORY, TOOL_EXECUTOR } from './runtime/runtime.tokens';

@Module({
  imports: [
    AiGatewayModule,
    AgentModule,
    PluginModule,
    WorkflowModule,
    KnowledgeModule,
    FileModule,
    WorkspaceModule,
  ],
  controllers: [AgentRuntimeController],
  providers: [
    AgentRuntimeService,
    AgentRunService,
    RunControlService,
    AgentConfigFactory,
    AgentRuntime,
    RuntimeAttachmentService,
    RuntimeKnowledgeService,
    RuntimeSettingsService,
    RuntimeToolExecutionService,
    ConversationMemoryService,
    { provide: RUNTIME_REPOSITORY, useClass: RuntimePrismaRepository },
    { provide: TOOL_EXECUTOR, useExisting: RuntimeToolExecutionService },
  ],
  exports: [AgentRuntimeService],
})
export class AgentRuntimeModule {}
