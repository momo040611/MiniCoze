import { Injectable, Logger } from '@nestjs/common';
import { AiGatewayService } from '../../../ai-gateway/ai-gateway.service';
import { ModelResolverService } from '../../../model-management/model-resolver.service';
import { ChatMessage } from '../../../../shared/types/agent';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

// LlmNodeExecutor：负责执行 type 为 'llm' 的节点，是工作流里真正调用大模型的地方。
// 流程：读节点配置 -> 选定用户消息 -> 组装 system/user 对话 -> 调 AI 网关 -> 把结果写回共享状态。
@Injectable()
export class LlmNodeExecutor implements WorkflowNodeExecutor {
  // 声明本执行器负责的节点类型，runner 通过它路由到这里。
  readonly type = 'llm';
  private readonly logger = new Logger(LlmNodeExecutor.name);

  // 注入 AI 网关服务，由它统一对接底层模型（OpenAI / DeepSeek 等）。
  constructor(
    private readonly aiGatewayService: AiGatewayService,
    private readonly modelResolverService: ModelResolverService,
  ) {}

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    // node.data 是节点配置；inputs 是其中承载运行参数的子对象（兼容 Coze 结构）。
    const nodeData = this.asRecord(context.node.data);
    const inputConfig = this.asRecord(nodeData.inputs);

    // 依次读取模型调用参数；读不到时用默认值兜底，保证节点总能运行。
    // pick：优先取顶层字段，没有再取 inputs 里的字段。
    // systemPrompt 支持 {{...}} 变量引用，这里先解析模板。
    const systemPrompt = context.resolveTemplate(
      this.readString(
        this.pick(nodeData, inputConfig, 'systemPrompt'),
        '你是一个有帮助的工作流节点助手。',
      ),
    );
    const model = this.readString(
      this.pick(nodeData, inputConfig, 'model'),
      'deepseek-chat',
    );
    const workspaceModelId = this.readOptionalString(
      this.pick(nodeData, inputConfig, 'workspaceModelId'),
    );
    const temperature = this.readNumber(
      this.pick(nodeData, inputConfig, 'temperature'),
      0.7,
    );
    const maxTokens = this.readNumber(
      this.pick(nodeData, inputConfig, 'maxTokens'),
      512,
    );

    // 决定本次真正发给模型的“用户内容”（见 resolveUserMessage 的优先级）。
    const userMessage = this.resolveUserMessage(context);

    // 组装标准对话：一条 system（人设/约束）+ 一条 user（实际问题）。
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    this.logger.debug(
      `[llm] 调模型 model=${model} temperature=${temperature} maxTokens=${maxTokens}`,
    );
    this.logger.debug(`[llm] systemPrompt="${systemPrompt}"`);
    this.logger.debug(`[llm] userMessage="${userMessage}"`);

    // 调用大模型，拿到回复内容与 token 使用量。
    // 工作流第一阶段不强制前端传 workspaceModelId：
    // 有 workspaceModelId 才走新模型解析，没有则继续走旧 model 字符串。
    const response = workspaceModelId
      ? await this.generateWithWorkspaceModel({
          workspaceId: context.state.variableContext.workspaceId,
          workspaceModelId,
          model,
          temperature,
          maxTokens,
          messages,
        })
      : await this.aiGatewayService.generate({
          model,
          temperature,
          maxTokens,
          messages,
        });

    this.logger.debug(
      `[llm] 模型返回 content="${response.content}" usage=${JSON.stringify(response.usage ?? null)}`,
    );

    // 把模型回复写进共享状态，作为“接力棒”传给下游节点（如 end）。
    context.state.currentText = response.content;

    // 返回节点输出，会被记录到该节点的执行日志（WorkflowRunNode）。
    return {
      output: {
        model: response.model,
        content: response.content,
        usage: response.usage
          ? {
              promptTokens: response.usage.promptTokens,
              completionTokens: response.usage.completionTokens,
              totalTokens: response.usage.totalTokens,
            }
          : null,
      },
    };
  }

  // 按优先级决定发给模型的用户消息：
  // 1) 节点显式配置的 prompt / userPrompt
  // 2) 上游节点传下来的 currentText（接力内容）
  // 3) 原始运行输入里的 query
  // 4) 都没有时的兜底提示语
  private resolveUserMessage(context: WorkflowNodeExecutionContext): string {
    const nodeData = this.asRecord(context.node.data);
    const inputConfig = this.asRecord(nodeData.inputs);
    const prompt = this.readString(
      this.pick(nodeData, inputConfig, 'prompt') ??
        this.pick(nodeData, inputConfig, 'userPrompt'),
      '',
    );
    if (prompt) {
      // prompt 里可能含 {{loop.item}} / {{nodeId.output.x}} 等引用，解析后再用。
      return context.resolveTemplate(prompt);
    }
    if (context.state.currentText.trim().length > 0) {
      return context.state.currentText;
    }

    const query = context.input.query;
    if (typeof query === 'string' && query.trim().length > 0) {
      return query;
    }

    return '请根据当前上下文给出简洁回复。';
  }

  // 把未知类型安全转成对象：不是普通对象（如 null/数组/字符串）就返回空对象，避免后续访问报错。
  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  // 安全读取字符串：值为非空字符串才用，否则返回默认值。
  private readString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }

  private readOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    return undefined;
  }

  private async generateWithWorkspaceModel(input: {
    workspaceId: string;
    workspaceModelId: string;
    model: string;
    temperature: number;
    maxTokens: number;
    messages: ChatMessage[];
  }) {
    // 节点显式配置数据库模型时，仍保留 legacy model 作为解析失败后的兜底。
    const resolvedModel = await this.modelResolverService.resolve({
      workspaceId: input.workspaceId,
      requestedWorkspaceModelId: input.workspaceModelId,
      legacyModelName: input.model,
    });

    if (resolvedModel.source !== 'workspace') {
      return this.aiGatewayService.generate({
        model: resolvedModel.modelId,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        messages: input.messages,
      });
    }

    return this.aiGatewayService.generateWithResolvedModel(resolvedModel, {
      model: resolvedModel.modelId,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      messages: input.messages,
    });
  }

  // 安全读取数字：值为有效数字才用，否则返回默认值。
  private readNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  }

  // 取配置字段：优先从 primary（顶层 data）取，取不到再从 fallback（data.inputs）取。
  // 目的是同时兼容“参数放顶层”和“参数放 inputs 里”两种前端协议。
  private pick(
    primary: Record<string, unknown>,
    fallback: Record<string, unknown>,
    key: string,
  ): unknown {
    if (primary[key] !== undefined) {
      return primary[key];
    }
    return fallback[key];
  }
}
