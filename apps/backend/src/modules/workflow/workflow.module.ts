import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { PublishModule } from '../publish/publish.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AgentWorkflowBindingController } from './agent-workflow-binding.controller';
import { AgentWorkflowBindingService } from './agent-workflow-binding.service';
import { WorkflowAsyncRunner } from './internal/compose/workflow-async-runner';
import { WorkflowCancellationRegistry } from './internal/execute/workflow-cancellation.registry';
import { CodeNodeExecutor } from './internal/nodes/code-node.executor';
import { EndNodeExecutor } from './internal/nodes/end-node.executor';
import { HttpNodeExecutor } from './internal/nodes/http-node.executor';
import { LlmNodeExecutor } from './internal/nodes/llm-node.executor';
import { SelectorNodeExecutor } from './internal/nodes/selector-node.executor';
import { StartNodeExecutor } from './internal/nodes/start-node.executor';
import { WorkflowController } from './workflow.controller';
import { WorkflowMapper } from './workflow.mapper';
import { WorkflowRunService } from './workflow-run.service';
import { WorkflowService } from './workflow.service';
import { WorkflowToolExecutionService } from './workflow-tool-execution.service';
import { WorkflowToolRegistryService } from './workflow-tool-registry.service';

@Module({
  imports: [WorkspaceModule, AiGatewayModule, PublishModule],
  controllers: [WorkflowController, AgentWorkflowBindingController],
  providers: [
    WorkflowService,
    WorkflowRunService,
    WorkflowMapper,
    AgentWorkflowBindingService,
    WorkflowToolRegistryService,
    WorkflowToolExecutionService,
    WorkflowAsyncRunner,
    WorkflowCancellationRegistry,
    StartNodeExecutor,
    LlmNodeExecutor,
    EndNodeExecutor,
    SelectorNodeExecutor,
    CodeNodeExecutor,
    HttpNodeExecutor,
  ],
  exports: [
    WorkflowRunService,
    WorkflowMapper,
    AgentWorkflowBindingService,
    WorkflowToolRegistryService,
    WorkflowToolExecutionService,
  ],
})
export class WorkflowModule {}
