import { Injectable } from '@nestjs/common';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

@Injectable()
export class StartNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'start';

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const query = this.pickTextInput(context.input);
    context.state.currentText = query;

    return await Promise.resolve({
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
