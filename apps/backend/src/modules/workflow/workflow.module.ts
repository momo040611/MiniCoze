import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkflowAsyncRunner } from './internal/compose/workflow-async-runner';
import { WorkflowCancellationRegistry } from './internal/execute/workflow-cancellation.registry';
import { CodeNodeExecutor } from './internal/nodes/code-node.executor';
import { EndNodeExecutor } from './internal/nodes/end-node.executor';
import { LlmNodeExecutor } from './internal/nodes/llm-node.executor';
import { SelectorNodeExecutor } from './internal/nodes/selector-node.executor';
import { StartNodeExecutor } from './internal/nodes/start-node.executor';
import { WorkflowController } from './workflow.controller';
import { WorkflowMapper } from './workflow.mapper';
import { WorkflowRunService } from './workflow-run.service';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [WorkspaceModule, AiGatewayModule],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    WorkflowRunService,
    WorkflowMapper,
    WorkflowAsyncRunner,
    WorkflowCancellationRegistry,
    StartNodeExecutor,
    LlmNodeExecutor,
    EndNodeExecutor,
    SelectorNodeExecutor,
    CodeNodeExecutor,
  ],
})
export class WorkflowModule {}
