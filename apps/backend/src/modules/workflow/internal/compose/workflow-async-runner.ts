import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
} from '../../workflow-definition.validator';
import { WorkflowRunEventBus } from '../execute/workflow-run-event-bus';
import { WorkflowCanceledError } from '../execute/workflow-cancellation.registry';
import {
  resolveTemplate,
  resolveValueRef,
  VariableScope,
} from '../variable/variable-resolver';
import { CodeNodeExecutor } from '../nodes/code-node.executor';
import { EndNodeExecutor } from '../nodes/end-node.executor';
import { HttpNodeExecutor } from '../nodes/http-node.executor';
import { LlmNodeExecutor } from '../nodes/llm-node.executor';
import { SelectorNodeExecutor } from '../nodes/selector-node.executor';
import { StartNodeExecutor } from '../nodes/start-node.executor';
import {
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
  WorkflowRuntimeState,
  WorkflowVariableContext,
} from '../nodes/workflow-node-executor';
import { VariableNodeExecutor } from '../nodes/variable-node.executor';

export interface WorkflowAsyncRunInput {
  runId: string;
  definition: WorkflowDefinition;
  input: Record<string, unknown>;
  eventBus: WorkflowRunEventBus;
  // 取消检查：每个节点执行前调用，返回 true 则中断运行（抛 WorkflowCanceledError）。
  isCanceled?: () => boolean;
  // 持久化变量：运行开始前从库加载的会话级/全局级变量，以及它们的归属上下文。
  variableContext: WorkflowVariableContext;
  sessionVars?: Record<string, unknown>;
  globalVars?: Record<string, unknown>;
}

export interface WorkflowAsyncRunOutput {
  output: Record<string, unknown>;
}

// WorkflowAsyncRunner：基于图遍历的工作流执行引擎。
// 能力：
// - 普通节点：执行后沿唯一出口走到下一个节点
// - selector：按命中分支的端口路由（if / switch）
// - loop：遍历数组，对每一项执行内部子图（blocks + edges）
// - 变量：节点配置里的 {{...}} 会按当前作用域解析
//
// 约束：
// - 顶层必须有 start 节点
// - 顶层图本身不允许出现回环（循环必须用 loop 节点表达）
const LOOP_NODE_TYPE = 'loop';
const MAX_LOOP_ITEMS = 200;
// loop 默认并发数；可由节点 inputs.concurrency 覆盖，并被 MAX 限制。
const DEFAULT_LOOP_CONCURRENCY = 5;
const MAX_LOOP_CONCURRENCY = 20;
// 节点默认超时（毫秒）；可由节点 inputs.timeout 覆盖，0 表示关闭超时。
const DEFAULT_NODE_TIMEOUT_MS = 60000;

@Injectable()
export class WorkflowAsyncRunner {
  private readonly logger = new Logger(WorkflowAsyncRunner.name);
  private readonly executors: Map<string, WorkflowNodeExecutor>;

  constructor(
    startNodeExecutor: StartNodeExecutor,
    llmNodeExecutor: LlmNodeExecutor,
    endNodeExecutor: EndNodeExecutor,
    selectorNodeExecutor: SelectorNodeExecutor,
    codeNodeExecutor: CodeNodeExecutor,
    httpNodeExecutor: HttpNodeExecutor,
    variableNodeExecutor: VariableNodeExecutor,
  ) {
    this.executors = new Map<string, WorkflowNodeExecutor>([
      [startNodeExecutor.type, startNodeExecutor],
      [llmNodeExecutor.type, llmNodeExecutor],
      [endNodeExecutor.type, endNodeExecutor],
      [selectorNodeExecutor.type, selectorNodeExecutor],
      [codeNodeExecutor.type, codeNodeExecutor],
      [httpNodeExecutor.type, httpNodeExecutor],
      [variableNodeExecutor.type, variableNodeExecutor],
    ]);
  }

  // 执行入口：初始化运行时状态，从 start 节点开始遍历整张图。
  async run(input: WorkflowAsyncRunInput): Promise<WorkflowAsyncRunOutput> {
    // 运行时状态在所有节点间共享：originalInput 是本次输入，
    // nodeOutputs 记录每个节点输出（供变量引用），currentText 是兼容用的文本接力。
    const state: WorkflowRuntimeState = {
      originalInput: input.input,
      currentText: '',
      nodeOutputs: {},
      // 持久化变量的内存副本：从库加载的初值，运行内会被 set 节点就地更新。
      sessionVars: input.sessionVars ?? {},
      globalVars: input.globalVars ?? {},
      variableContext: input.variableContext,
    };

    // 顶层图必须有 start 作为唯一入口。
    const startNode = input.definition.nodes.find(
      (node) => node.type === 'start',
    );
    if (!startNode) {
      throw new BusinessException(
        '工作流缺少 start 节点，无法运行',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`▶️  run 开始 runId=${input.runId}`);
    this.logger.log(`   input.input(原始)=${this.dump(input.input)}`);
    this.logger.log(`   input.definition(原始)=${this.dump(input.definition)}`);

    const isCanceled = input.isCanceled ?? ((): boolean => false);
    const finalOutput = await this.executeGraph(
      input.definition.nodes,
      input.definition.edges,
      startNode,
      state,
      input.eventBus,
      input.runId,
      undefined,
      isCanceled,
    );

    const output = finalOutput ?? { result: state.currentText };
    this.logger.log(
      `✅ run 结束 runId=${input.runId} 最终输出=${this.preview(output)}`,
    );
    return { output };
  }

  // 执行一张图（顶层图或 loop 内部子图）：
  // 从 entry 节点出发，按出口边一路走，直到 end 节点或走到尽头。
  // 子图执行和顶层执行用的是同一套图遍历逻辑
  private async executeGraph(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    entry: WorkflowNode,
    state: WorkflowRuntimeState,
    eventBus: WorkflowRunEventBus,
    runId: string,
    loopScope: Record<string, unknown> | undefined,
    isCanceled: () => boolean,
  ): Promise<Record<string, unknown>> {
    // nodeMap: 按 id 快速取节点；outgoing: 某节点的所有出口边。
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    // outgoing 的结构示例（source -> 出口边数组）：
    // Map {
    //   "start_1" => [ { target: "sel_1" } ],
    //   "sel_1"   => [ { target: "llm_a", sourcePort: "yes" },
    //                  { target: "llm_b", sourcePort: "no"  } ],
    //   "llm_a"   => [ { target: "end_1" } ],
    //   "llm_b"   => [ { target: "end_1" } ],
    // }
    const outgoing = this.buildOutgoing(edges);

    const scopeLabel = loopScope ? '子图(loop)' : '顶层图';
    this.logger.debug(`🧭 进入${scopeLabel} entry(原始)=${this.dump(entry)}`);
    this.logger.debug(`nodeMap(原始)=${this.dump(nodeMap)}`);
    this.logger.debug(`edges(原始)=${this.dump(edges)}`);

    let current: WorkflowNode | undefined = entry;
    let lastOutput: Record<string, unknown> = {};
    // visited 防止非法回环；guard 是步数兜底，双保险防死循环。
    const visited = new Set<string>();
    let guard = 0;
    // this.logger.debug(`current(原始)=${this.dump(current)}`);

    while (current) {
      // 每个节点执行前检查取消信号：已取消则立刻中断（抛专用错误）。
      if (isCanceled()) {
        throw new WorkflowCanceledError();
      }

      if (visited.has(current.id)) {
        throw new BusinessException(
          '检测到非法回环，循环请使用 loop 节点表达',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
      visited.add(current.id);

      // 执行当前节点（普通/loop/selector），拿到输出和可能的分支端口。
      this.logger.debug(`执行当前节点 current(原始)=${this.dump(current)}`);
      this.logger.debug(`state(原始)=${this.dump(state)}`);
      this.logger.debug(`eventBus(原始)=${this.dump(eventBus)}`);
      this.logger.debug(`runId(原始)=${this.dump(runId)}`);
      this.logger.debug(`loopScope(原始)=${this.dump(loopScope)}`);
      const result = await this.executeNode(
        current,
        state,
        eventBus,
        runId,
        loopScope,
        isCanceled,
      );
      lastOutput = result.output;

      // 到达 end 节点 -> 整张图结束，返回其输出。
      if (current.type === 'end') {
        return result.output;
      }

      // 没有出口边 -> 走到尽头（子图常见情况），返回当前输出。
      const edgesFrom = outgoing.get(current.id) ?? [];
      if (edgesFrom.length === 0) {
        return result.output;
      }

      // 根据节点给出的端口（selector 会给）挑选下一条边。
      const nextEdge = this.pickEdge(edgesFrom, result.nextPort);
      if (!nextEdge) {
        return result.output;
      }

      if (result.nextPort !== undefined) {
        this.logger.debug(
          `🔀 分支路由 ${current.id} 选择端口=${result.nextPort} -> ${nextEdge.target}`,
        );
      } else {
        this.logger.debug(`➡️  ${current.id} -> ${nextEdge.target}`);
      }

      // 沿选中的边走到下一个节点，继续循环。
      current = nodeMap.get(nextEdge.target);
      guard += 1;
      if (guard > nodes.length + 50) {
        throw new BusinessException(
          '工作流执行步数异常，超过预期上限',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return lastOutput;
  }

  // 执行单个节点：发开始事件 -> 执行(普通/loop) -> 发完成/失败事件。
  private async executeNode(
    node: WorkflowNode,
    state: WorkflowRuntimeState,
    eventBus: WorkflowRunEventBus,
    runId: string,
    loopScope: Record<string, unknown> | undefined,
    isCanceled: () => boolean,
  ): Promise<WorkflowNodeExecutionResult> {
    const startedAt = new Date();
    this.logger.log(`  ⏳ 节点开始 [${node.type}] ${node.id}`);
    await eventBus.publish({
      type: 'node.started',
      runId,
      nodeId: node.id,
      nodeType: node.type,
      at: startedAt,
      input: state.originalInput,
    });

    try {
      // 执行节点。loop 走子图（自带并发/失败策略），其它节点走执行器并套「超时+重试」护栏。
      const result =
        node.type === LOOP_NODE_TYPE
          ? await this.executeLoop(
              node,
              state,
              eventBus,
              runId,
              loopScope,
              isCanceled,
            )
          : await this.runLeafNode(node, state, loopScope);

      state.nodeOutputs[node.id] = result.output;
      const durationMs = this.diffMs(startedAt, new Date());
      this.logger.log(
        `  ✔️  节点完成 [${node.type}] ${node.id} 耗时=${durationMs}ms 输出=${this.preview(result.output)}`,
      );
      await eventBus.publish({
        type: 'node.completed',
        runId,
        nodeId: node.id,
        nodeType: node.type,
        at: new Date(),
        output: result.output,
        durationMs,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`  ❌ 节点失败 [${node.type}] ${node.id}: ${message}`);
      await eventBus.publish({
        type: 'node.failed',
        runId,
        nodeId: node.id,
        nodeType: node.type,
        at: new Date(),
        input: state.originalInput,
        errorMessage: message,
        durationMs: this.diffMs(startedAt, new Date()),
      });
      throw error;
    }
  }

  // 执行 loop 节点：解析待遍历数组，对每一项执行内部子图。
  private async executeLoop(
    node: WorkflowNode,
    state: WorkflowRuntimeState,
    eventBus: WorkflowRunEventBus,
    runId: string,
    parentLoopScope: Record<string, unknown> | undefined,
    isCanceled: () => boolean,
  ): Promise<WorkflowNodeExecutionResult> {
    // 解析 items：用 resolveValueRef 是为了保留数组原始类型（不能被转成字符串）。
    const scope = this.buildScope(state, parentLoopScope);
    const inputs = this.asRecord(this.asRecord(node.data).inputs);
    const resolvedItems = resolveValueRef(inputs.items, scope);
    this.logger.debug(
      `[executeLoop] inputs.items(原始)=${this.dump(inputs.items)}`,
    );
    this.logger.debug(`[executeLoop] scope(原始)=${this.dump(scope)}`);
    this.logger.debug(
      `[executeLoop] resolvedItems(解析后)=${this.dump(resolvedItems)}`,
    );

    if (!Array.isArray(resolvedItems)) {
      throw new BusinessException(
        `loop 节点 ${node.id} 的 items 必须解析为数组`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    const items: unknown[] = resolvedItems;
    //循环次数超过上限
    if (items.length > MAX_LOOP_ITEMS) {
      throw new BusinessException(
        `loop 节点 ${node.id} 迭代次数超过上限 ${MAX_LOOP_ITEMS}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    // loop 的内部子图：blocks 是子节点，blockEdges 是子图连线。
    const blocks: WorkflowNode[] = node.blocks ?? [];
    const blockEdges: WorkflowEdge[] = node.edges ?? [];
    const entry = this.findSubGraphEntry(blocks, blockEdges);
    this.logger.debug(`[executeLoop] entry(原始)=${this.dump(entry)}`);
    this.logger.debug(`[executeLoop] blocks(原始)=${this.dump(blocks)}`);
    this.logger.debug(
      `[executeLoop] blockEdges(原始)=${this.dump(blockEdges)}`,
    );

    const concurrency = this.resolveConcurrency(inputs.concurrency);
    // 失败策略：abort=某轮失败则整体失败（默认）；continue=跳过失败轮、记录错误、继续。
    const onError = inputs.onError === 'continue' ? 'continue' : 'abort';
    this.logger.log(
      `  🔁 loop ${node.id} 开始迭代 共 ${items.length} 项 子节点数=${blocks.length} 并发=${concurrency} 失败策略=${onError}`,
    );

    // 结果按 index 落位，保证输出顺序和输入数组一致（即使并发乱序完成）。
    const results: Array<{
      index: number;
      item: unknown;
      output: Record<string, unknown>;
    }> = new Array(items.length) as Array<{
      index: number;
      item: unknown;
      output: Record<string, unknown>;
    }>;

    // 共享游标：每个 worker 抢一个 index 来跑（JS 单线程，cursor++ 是原子的）。
    let cursor = 0;
    const runOneIteration = async (index: number): Promise<void> => {
      const loopScope: Record<string, unknown> = {
        ...(parentLoopScope ?? {}),
        item: items[index],
        index,
      };

      this.logger.debug(
        `  🔂 loop ${node.id} 第 ${index + 1}/${items.length} 轮 item=${this.preview(items[index])}`,
      );

      let iterationOutput: Record<string, unknown> = {};
      if (entry) {
        // 关键：每轮用独立 state（隔离 nodeOutputs），避免并发时各轮互相覆盖。
        const iterationState = this.forkState(state);
        try {
          iterationOutput = await this.executeGraph(
            blocks,
            blockEdges,
            entry,
            iterationState,
            eventBus,
            runId,
            loopScope,
            isCanceled,
          );
        } catch (error) {
          // 取消信号不受失败策略影响，直接向上抛出中断整个运行。
          if (error instanceof WorkflowCanceledError) {
            throw error;
          }
          if (onError === 'abort') {
            throw error;
          }
          // continue 策略：记录错误、跳过该轮，不中断整个 loop。
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `  ⚠️ loop ${node.id} 第 ${index + 1} 轮失败，跳过：${message}`,
          );
          iterationOutput = { error: message };
        }
        this.logger.debug(
          `[executeLoop] iterationOutput(原始)=${this.dump(iterationOutput)}`,
        );
      }
      // 并发完成顺序是乱的（item3 可能比 item1 先跑完），但输出要保持原顺序
      results[index] = { index, item: items[index], output: iterationOutput };
    };

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) {
          return;
        }
        await runOneIteration(index);
      }
    };

    const workerCount = Math.min(concurrency, items.length);
    // 并发执行workerCount个worker，每个worker执行runOneIteration
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    // loop 节点的输出 = 迭代次数 + 每轮结果数组，供后续节点引用。
    return { output: { count: items.length, results } };
  }

  // 执行普通（非 loop）节点，套上「超时 + 重试」护栏。
  // 配置来自 node.data.inputs：timeout(ms,默认60s,0关闭) / retry(次数) / retryDelay(ms)。
  private async runLeafNode(
    node: WorkflowNode,
    state: WorkflowRuntimeState,
    loopScope: Record<string, unknown> | undefined,
  ): Promise<WorkflowNodeExecutionResult> {
    const inputs = this.asRecord(this.asRecord(node.data).inputs);
    const timeoutMs = this.readNumber(inputs.timeout, DEFAULT_NODE_TIMEOUT_MS);
    const retry = Math.max(0, this.readNumber(inputs.retry, 0));
    const retryDelay = Math.max(0, this.readNumber(inputs.retryDelay, 0));
    const executor = this.resolveExecutor(node);

    return this.withRetry(
      () =>
        this.withTimeout(
          executor.execute(this.buildContext(node, state, loopScope)),
          timeoutMs,
          node.id,
        ),
      retry,
      retryDelay,
      node.id,
    );
  }

  // 超时护栏：超过 ms 未完成则 reject（ms<=0 表示不限制）。
  // 注意：仅让运行不再阻塞等待，底层请求（如模型调用）不会被真正中止。
  private withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    if (ms <= 0) {
      return p;
    }
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`节点 ${label} 执行超时 (${ms}ms)`));
      }, ms);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }

  // 重试护栏：失败后最多再试 retry 次，每次间隔 delay 毫秒。
  private async withRetry<T>(
    fn: () => Promise<T>,
    retry: number,
    delay: number,
    label: string,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retry; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < retry) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `  🔁 节点 ${label} 第 ${attempt + 1} 次失败，准备重试：${message}`,
          );
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    }
    throw lastError;
  }

  private readNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  }

  // 解析并发数：默认 5，受 inputs.concurrency 覆盖，并夹在 [1, MAX] 之间。
  private resolveConcurrency(value: unknown): number {
    const n =
      typeof value === 'number' && Number.isFinite(value)
        ? Math.floor(value)
        : DEFAULT_LOOP_CONCURRENCY;
    return Math.max(1, Math.min(n, MAX_LOOP_CONCURRENCY));
  }

  // 复制一份运行时状态：nodeOutputs 浅拷贝成新对象，
  // 这样每个循环迭代的子节点输出互相隔离，可以安全并发执行。
  private forkState(state: WorkflowRuntimeState): WorkflowRuntimeState {
    return {
      originalInput: state.originalInput,
      currentText: state.currentText,
      nodeOutputs: { ...state.nodeOutputs },
      // 持久化变量是“共享状态”，各迭代共用同一份引用（set 对全局可见）。
      sessionVars: state.sessionVars,
      globalVars: state.globalVars,
      variableContext: state.variableContext,
    };
  }

  // 构建当前节点的执行上下文，注入变量解析能力。
  private buildContext(
    node: WorkflowNode,
    state: WorkflowRuntimeState,
    loopScope: Record<string, unknown> | undefined,
  ) {
    this.logger.debug(`[buildContext] node(原始)=${this.dump(node)}`);
    this.logger.debug(`[buildContext] state(原始)=${this.dump(state)}`);
    this.logger.debug(`[buildContext] loopScope(原始)=${this.dump(loopScope)}`);
    const scope = this.buildScope(state, loopScope);
    return {
      node,
      input: state.originalInput,
      state,
      resolveTemplate: (template: string): string =>
        resolveTemplate(template, scope),
      resolveValue: (ref: unknown): unknown => resolveValueRef(ref, scope),
    };
  }

  // 构建当前节点的执行上下文，注入变量解析能力。
  private buildScope(
    state: WorkflowRuntimeState,
    loopScope: Record<string, unknown> | undefined,
  ): VariableScope {
    return {
      input: state.originalInput,
      nodeOutputs: state.nodeOutputs,
      loop: loopScope,
      // 持久化变量：支持 {{session.x}} / {{global.x}} 引用。
      session: state.sessionVars,
      global: state.globalVars,
    };
  }

  // 把边按 source 分组，便于查某节点的所有出口。
  private buildOutgoing(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
    const outgoing = new Map<string, WorkflowEdge[]>();
    for (const edge of edges) {
      const list = outgoing.get(edge.source) ?? [];
      list.push(edge);
      outgoing.set(edge.source, list);
    }
    return outgoing;
  }

  // 选择下一条边：
  // - 分支节点给了 nextPort -> 优先匹配同端口的边，否则回退到无端口边
  // - 普通节点 -> 取无端口边，没有则取第一条
  private pickEdge(
    edges: WorkflowEdge[],
    nextPort: string | undefined,
  ): WorkflowEdge | undefined {
    if (nextPort !== undefined) {
      const matched = edges.find((edge) => edge.sourcePort === nextPort);
      if (matched) {
        return matched;
      }
      return edges.find((edge) => !edge.sourcePort);
    }
    return edges.find((edge) => !edge.sourcePort) ?? edges[0];
  }

  // 子图入口：取没有任何入边的节点；找不到则退化为第一个节点。
  private findSubGraphEntry(
    blocks: WorkflowNode[],
    edges: WorkflowEdge[],
  ): WorkflowNode | undefined {
    if (blocks.length === 0) {
      return undefined;
    }
    const hasIncoming = new Set(edges.map((edge) => edge.target));
    return blocks.find((block) => !hasIncoming.has(block.id)) ?? blocks[0];
  }

  private resolveExecutor(node: WorkflowNode): WorkflowNodeExecutor {
    const executor = this.executors.get(node.type);
    if (!executor) {
      throw new BusinessException(
        `暂不支持的节点类型: ${node.type}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    return executor;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private diffMs(start: Date, end: Date): number {
    return Math.max(0, end.getTime() - start.getTime());
  }

  // 打印原始数据：完整 JSON，不截断、不加工，方便排查真实结构。
  private dump(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  // 把任意值转成简短字符串用于日志，超长会截断，避免刷屏。
  private preview(value: unknown): string {
    let text: string;
    try {
      text = typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      text = String(value);
    }
    if (text === undefined) {
      return 'undefined';
    }
    const MAX = 200;
    return text.length > MAX ? `${text.slice(0, MAX)}…(${text.length})` : text;
  }
}
