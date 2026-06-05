import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

// EndNodeExecutor：工作流收尾节点，决定整条工作流的最终输出。
// 输出来源优先级（输出映射机制）：
// 1) data.inputs.outputs = { key: "{{ref}}" } -> 按字段映射，多字段输出
// 2) data.inputs.result = "{{ref}}"            -> 单字段映射到 result
// 3) 都没配 -> 兜底取 state.currentText（兼容旧逻辑，循环场景只会是最后一轮）
@Injectable()
export class EndNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'end';
  private readonly logger = new Logger(EndNodeExecutor.name);

  execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const inputs = this.asRecord(this.asRecord(context.node.data).inputs);

    // 1) 多字段输出映射：把 outputs 里每个引用解析成真实值。
    if (this.isRecord(inputs.outputs)) {
      const mapped: Record<string, unknown> = {};
      for (const [key, ref] of Object.entries(inputs.outputs)) {
        mapped[key] = context.resolveValue(ref);
      }
      this.logger.debug(
        `[end] 输出映射(outputs)=${JSON.stringify(mapped)}`,
      );
      return Promise.resolve({ output: { ...mapped, final: true } });
    }

    // 2) 单字段映射：result 显式指定来源（保留原始类型，如数组/对象）。
    if (inputs.result !== undefined) {
      const result = context.resolveValue(inputs.result);
      this.logger.debug(`[end] result 映射 -> ${JSON.stringify(result)}`);
      return Promise.resolve({ output: { result, final: true } });
    }

    // 3) 兜底：沿用 currentText（未配置映射时的兼容行为）。
    const resultText = context.state.currentText;
    this.logger.debug(`[end] 回退 currentText result="${resultText}"`);
    return Promise.resolve({
      output: {
        result: resultText,
        final: true,
      },
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (this.isRecord(value)) {
      return value;
    }
    return {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
