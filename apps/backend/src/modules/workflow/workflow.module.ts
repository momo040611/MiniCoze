import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ModelManagementModule } from '../model-management/model-management.module';
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
import { VariableNodeExecutor } from './internal/nodes/variable-node.executor';
import { WorkflowVariableService } from './internal/variable/workflow-variable.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowMapper } from './workflow.mapper';
import { WorkflowRunService } from './workflow-run.service';
import { WorkflowService } from './workflow.service';
import { WorkflowToolExecutionService } from './workflow-tool-execution.service';
import { WorkflowToolRegistryService } from './workflow-tool-registry.service';

// 工作流模块接入模型管理模块，但 LLM 节点仍默认走旧 model 字符串，保证现有工作流稳定。
@Module({
  imports: [
    WorkspaceModule,
    AiGatewayModule,
    PublishModule,
    ModelManagementModule,
  ],
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
    VariableNodeExecutor,
    WorkflowVariableService,
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
