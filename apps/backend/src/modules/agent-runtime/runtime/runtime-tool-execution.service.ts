import { Injectable } from '@nestjs/common';
import type { ToolCall, ToolResult } from '../../../shared/types/agent';
import type {
  RuntimeContext,
  ToolExecutor,
} from '../../../shared/types/runtime';
import { PluginExecutionService } from '../../plugins/plugin-execution.service';
import { WorkflowToolExecutionService } from '../../workflow/workflow-tool-execution.service';

@Injectable()
export class RuntimeToolExecutionService implements ToolExecutor {
  constructor(
    private readonly pluginExecutionService: PluginExecutionService,
    private readonly workflowToolExecutionService: WorkflowToolExecutionService,
  ) {}

  execute(input: {
    toolCall: ToolCall;
    context: RuntimeContext;
  }): Promise<ToolResult> {
    if (
      this.workflowToolExecutionService.supports(input.toolCall.function.name)
    ) {
      return this.workflowToolExecutionService.execute({
        functionName: input.toolCall.function.name,
        rawArguments: input.toolCall.function.arguments,
        toolCallId: input.toolCall.id,
        context: input.context,
      });
    }

    return this.pluginExecutionService.execute(input);
  }
}
