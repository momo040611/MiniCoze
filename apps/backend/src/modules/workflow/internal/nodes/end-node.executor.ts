import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

@Injectable()
export class EndNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'end';
  private readonly logger = new Logger(EndNodeExecutor.name);

  execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const resultText = context.state.currentText;
    this.logger.debug(`[end] 收尾输出 result="${resultText}"`);
    return Promise.resolve({
      output: {
        result: resultText,
        final: true,
      },
    });
  }
}
