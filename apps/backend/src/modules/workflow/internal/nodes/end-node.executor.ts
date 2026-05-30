import { Injectable } from '@nestjs/common';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

@Injectable()
export class EndNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'end';

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const resultText = context.state.currentText;
    return {
      output: {
        result: resultText,
        final: true,
      },
    };
  }
}

