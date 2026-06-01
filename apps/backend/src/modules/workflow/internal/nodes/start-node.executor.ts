import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

@Injectable()
export class StartNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'start';
  private readonly logger = new Logger(StartNodeExecutor.name);

  execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const query = this.pickTextInput(context.input);
    context.state.currentText = query;
    this.logger.debug(
      `[start] 提取起始文本 query="${query}" 原始输入=${JSON.stringify(context.input)}`,
    );

    return Promise.resolve({
      output: {
        input: context.input,
        query,
      },
    });
  }

  private pickTextInput(input: Record<string, unknown>): string {
    const candidates = ['query', 'message', 'text', 'input'];
    for (const key of candidates) {
      const value = input[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return '';
  }
}

