import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import {
  WorkflowDefinition,
  WorkflowNode,
} from '../../workflow-definition.validator';
import { WorkflowRunEvent } from '../execute/workflow-run-event';
import { WorkflowRunEventBus } from '../execute/workflow-run-event-bus';
import { EndNodeExecutor } from '../nodes/end-node.executor';
import { LlmNodeExecutor } from '../nodes/llm-node.executor';
import { StartNodeExecutor } from '../nodes/start-node.executor';
import {
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
  WorkflowRuntimeState,
} from '../nodes/workflow-node-executor';

export interface WorkflowAsyncRunInput {
  runId: string;
  definition: WorkflowDefinition;
  input: Record<string, unknown>;
  eventBus: WorkflowRunEventBus;
}
export interface WorkflowAsyncRunOutput {
  output: Record<string, unknown>;
}
// WorkflowAsyncRunner 是“基础执行编排器”：
// - 输入：已通过校验并解析后的 WorkflowDefinition
// - 过程：构建单路径执行序列，按顺序执行节点，并发布节点生命周期事件
// - 输出：最后一个节点输出（或当前文本兜底）
//
// 当前能力边界（foundation 模式）：
// 1) 仅支持单路径（每个节点最多一个下游）
// 2) 暂不支持分支（selector）与循环（loop）
// 3) 仅支持已注册节点执行器（start/llm/end）
@Injectable()
export class WorkflowAsyncRunner {
  private readonly executors: Map<string, WorkflowNodeExecutor>;

  constructor(
    startNodeExecutor: StartNodeExecutor,
    llmNodeExecutor: LlmNodeExecutor,
    endNodeExecutor: EndNodeExecutor,
  ) {
    this.executors = new Map<string, WorkflowNodeExecutor>([
      [startNodeExecutor.type, startNodeExecutor],
      [llmNodeExecutor.type, llmNodeExecutor],
      [endNodeExecutor.type, endNodeExecutor],
    ]);
  }

  async run(input: WorkflowAsyncRunInput): Promise<WorkflowAsyncRunOutput> {
    // Step A) 先把图定义转换成可顺序执行的路径。
    // 这里会做基础图约束检查：必须有 start、不能分支、不能循环。
    const path = this.buildExecutionPath(input.definition);

    // Step B) 初始化运行时状态。
    // state 在节点间共享：例如 start 提取的文本会被 llm/end 继续消费。
    const state: WorkflowRuntimeState = {
      originalInput: input.input,
      currentText: '',
      nodeOutputs: {},
    };

    // Step C) 按路径逐个节点执行，并在节点生命周期发布事件。
    for (const node of path) {
      const startedAt = new Date();
      // 节点开始事件：给外层持久化/观测模块记录节点起点。
      await input.eventBus.publish({
        type: 'node.started',
        runId: input.runId,
        nodeId: node.id,
        nodeType: node.type,
        at: startedAt,
        input: input.input,
      });

      try {
        // 1) 根据 node.type 选择执行器
        // 2) 执行节点逻辑
        // 3) 记录节点输出到共享状态
        const executor = this.resolveExecutor(node);
        const result = await executor.execute({
          node,
          input: input.input,
          state,
        });
        state.nodeOutputs[node.id] = result.output;
        // 节点成功事件：带上输出与耗时，供外层落库。
        await input.eventBus.publish(
          this.createCompletedEvent(input.runId, node, result, startedAt),
        );
      } catch (error) {
        // 节点失败事件：记录错误与耗时，然后把异常向外抛出，
        // 由上层（WorkflowRunService）统一更新 run 状态为 FAILED。
        const message = error instanceof Error ? error.message : String(error);
        await input.eventBus.publish({
          type: 'node.failed',
          runId: input.runId,
          nodeId: node.id,
          nodeType: node.type,
          at: new Date(),
          input: input.input,
          errorMessage: message,
          durationMs: this.diffMs(startedAt, new Date()),
        });
        throw error;
      }
    }

    // Step D) 执行完成后返回最终输出。
    // 默认取最后一个节点输出；若缺失则兜底返回当前文本结果。
    const lastNode = path[path.length - 1];
    return {
      output: state.nodeOutputs[lastNode.id] ?? { result: state.currentText },
    };
  }

  private createCompletedEvent(
    runId: string,
    node: WorkflowNode,
    result: WorkflowNodeExecutionResult,
    startedAt: Date,
  ): WorkflowRunEvent {
    // 统一封装节点成功事件，避免各处重复计算耗时字段。
    const endedAt = new Date();
    return {
      type: 'node.completed',
      runId,
      nodeId: node.id,
      nodeType: node.type,
      at: endedAt,
      output: result.output,
      durationMs: this.diffMs(startedAt, endedAt),
    };
  }

  private buildExecutionPath(definition: WorkflowDefinition): WorkflowNode[] {
    // 构建邻接关系：
    // - nodeMap: 节点 ID -> 节点定义
    // - outgoing: source -> target[]（某节点的所有下游）
    const nodeMap = new Map(definition.nodes.map((node) => [node.id, node]));
    const outgoing = new Map<string, string[]>();
    for (const edge of definition.edges) {
      const list = outgoing.get(edge.source) ?? [];
      list.push(edge.target);
      outgoing.set(edge.source, list);
    }

    const startNode = definition.nodes.find((node) => node.type === 'start');
    if (!startNode) {
      throw new BusinessException(
        '工作流缺少 start 节点，无法运行',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const path: WorkflowNode[] = [];
    const visited = new Set<string>();
    let current: WorkflowNode | undefined = startNode;
    // guard 用于双保险防御异常图（例如脏数据导致死循环）。
    let guard = 0;
    while (current) {
      // 已访问过说明出现环路，foundation 模式直接拒绝运行。
      if (visited.has(current.id)) {
        throw new BusinessException(
          '检测到循环依赖，foundation runner 暂不支持循环执行',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }

      path.push(current);
      visited.add(current.id);
      if (current.type === 'end') {
        break;
      }

      const nextIds = outgoing.get(current.id) ?? [];
      // foundation 模式：暂不支持一个节点通向多个下游（分支）。
      if (nextIds.length > 1) {
        throw new BusinessException(
          'foundation runner 暂不支持分支执行，请先保持单路径',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (nextIds.length === 0) {
        throw new BusinessException(
          `节点 ${current.id} 没有可执行的下游节点`,
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }

      current = nodeMap.get(nextIds[0]);
      guard += 1;
      // 图规模之外的异常步数，直接保护性中断。
      if (guard > definition.nodes.length + 5) {
        throw new BusinessException(
          '工作流路径异常，超过预期执行步数',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return path;
  }

  private resolveExecutor(node: WorkflowNode): WorkflowNodeExecutor {
    // 根据节点类型路由到具体执行器。
    // 例如 start -> StartNodeExecutor, llm -> LlmNodeExecutor。
    const executor = this.executors.get(node.type);
    if (!executor) {
      throw new BusinessException(
        `foundation runner 暂不支持节点类型: ${node.type}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    return executor;
  }

  private diffMs(start: Date, end: Date): number {
    return Math.max(0, end.getTime() - start.getTime());
  }
}
