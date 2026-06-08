import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import type { ToolResult } from '../../shared/types/agent';
import type { RuntimeContext } from '../../shared/types/runtime';
import { WorkflowRunService } from './workflow-run.service';
import {
  isWorkflowToolName,
  parseWorkflowToolName,
} from './workflow-tool.util';

@Injectable()
export class WorkflowToolExecutionService {
  constructor(private readonly workflowRunService: WorkflowRunService) {}

  async execute(input: {
    functionName: string;
    rawArguments: string;
    toolCallId: string;
    context: RuntimeContext;
  }): Promise<ToolResult> {
    const workflowVersionId = parseWorkflowToolName(input.functionName);
    if (!workflowVersionId) {
      throw new BusinessException(
        `非法的工作流函数名: ${input.functionName}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.assertWorkflowToolAllowed(input.functionName, input.context);
    const workflowInput = this.parseArguments(input.rawArguments);

    const result = await this.workflowRunService.runWithVersionId({
      userId: input.context.userId,
      workflowVersionId,
      input: workflowInput,
      agentId: input.context.agentId,
      conversationId: input.context.conversationId,
    });

    const metadata = {
      toolKind: 'workflow' as const,
      workflowId: result.workflowId,
      workflowVersionId: result.workflowVersionId ?? workflowVersionId,
      workflowName: result.workflowName ?? undefined,
    };

    if (result.status !== 'SUCCEEDED') {
      throw new Error(
        result.errorMessage ??
          `工作流执行失败 (${result.workflowName ?? result.workflowId})`,
      );
    }

    const payload = {
      runId: result.id,
      workflowId: result.workflowId,
      workflowVersionId: result.workflowVersionId,
      workflowName: result.workflowName,
      status: result.status,
      output: result.output ?? null,
    };

    return {
      toolCallId: input.toolCallId,
      output: JSON.stringify(payload),
      metadata,
      maskedArgs: workflowInput,
      maskedOutput: payload,
    };
  }

  supports(functionName: string): boolean {
    return isWorkflowToolName(functionName);
  }

  private assertWorkflowToolAllowed(
    functionName: string,
    context: RuntimeContext,
  ): void {
    const exists = (context.agentConfig.tools ?? []).some(
      (tool) => tool.function.name === functionName,
    );

    if (!exists) {
      throw new BusinessException(
        `工作流工具未绑定到当前 Agent: ${functionName}`,
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private parseArguments(raw: string): Record<string, unknown> {
    try {
      if (!raw || !raw.trim()) {
        return {};
      }

      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }

      throw new Error('工作流参数必须是 JSON 对象');
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : '工作流参数解析失败',
      );
    }
  }
}
