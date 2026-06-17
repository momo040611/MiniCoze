import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RuntimeEvent, ToolCall } from '../../shared/types/agent';
import type {
  AgentExecutionInput,
  AgentExecutionStrategy,
} from '../../shared/types/runtime';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { ModelResolverService } from '../model-management/model-resolver.service';
import {
  isWorkflowToolName,
  parseWorkflowToolName,
} from '../workflow/workflow-tool.util';

@Injectable()
export class SingleAgentRunner implements AgentExecutionStrategy {
  readonly mode = 'single_agent' as const;

  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly modelResolverService: ModelResolverService,
  ) {}

  async *stream({
    context,
    messages,
    toolExecutor,
  }: AgentExecutionInput): AsyncGenerator<RuntimeEvent, string, void> {
    const tools = context.agentConfig.tools ?? [];
    // 每次运行开始先解析模型。解析结果如果来自 workspace，就走动态 Provider；
    // 如果来自 legacy-env，就保持旧的 AiGatewayService.chatStream() 调用。
    const resolvedModel = await this.modelResolverService.resolve({
      workspaceId: context.agentConfig.workspaceId,
      requestedWorkspaceModelId: context.agentConfig.workspaceModelId,
      agentWorkspaceModelId: context.agentConfig.workspaceModelId,
      legacyModelName: context.agentConfig.model,
    });

    for (;;) {
      const assistantMessageId = randomUUID();
      const input = {
        messages,
        model: resolvedModel.modelId,
        temperature: context.agentConfig.temperature,
        maxTokens: context.agentConfig.maxTokens,
        tools,
      };
      const stream =
        // workspace 来源表示已经拿到了数据库 baseUrl + credential，可以动态调用。
        resolvedModel.source === 'workspace'
          ? this.aiGateway.chatStreamWithResolvedModel(resolvedModel, input)
          : this.aiGateway.chatStream(input);

      let toolCalls: ToolCall[] = [];
      const collected: string[] = [];

      for await (const chunk of stream) {
        if (chunk.content) {
          collected.push(chunk.content);
          yield {
            type: 'message.delta',
            runId: context.runId,
            messageId: assistantMessageId,
            content: chunk.content,
          };
        }

        if (chunk.toolCalls?.length) {
          toolCalls = chunk.toolCalls;
        }
      }

      const finalContent = collected.join('');

      if (!toolCalls.length) {
        yield {
          type: 'message.completed',
          runId: context.runId,
          messageId: assistantMessageId,
          content: finalContent,
        };
        return finalContent;
      }

      messages.push({
        role: 'assistant',
        content: finalContent || null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const rawArgs = this.safeParse(toolCall.function.arguments);
        const parsedArgs = this.maskPreviewArgs(rawArgs) ?? {};
        const initialMetadata = this.parseFunctionName(toolCall.function.name);
        yield {
          type: 'tool.call.created',
          runId: context.runId,
          toolCallId: toolCall.id,
          name: toolCall.function.name,
          ...initialMetadata,
          args: parsedArgs,
        };

        try {
          const result = await toolExecutor.execute({
            toolCall,
            context,
          });
          yield {
            type: 'tool.call.completed',
            runId: context.runId,
            toolCallId: toolCall.id,
            name: toolCall.function.name,
            ...initialMetadata,
            ...result.metadata,
            result: result.maskedOutput ?? result.output,
          };

          messages.push({
            role: 'tool',
            content: result.output,
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          yield {
            type: 'tool.call.failed',
            runId: context.runId,
            toolCallId: toolCall.id,
            name: toolCall.function.name,
            ...initialMetadata,
            error: message,
          };
          throw error;
        }
      }
    }
  }

  private safeParse(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  private parseFunctionName(name: string): {
    toolKind?: 'plugin' | 'workflow';
    pluginCode?: string;
    toolCode?: string;
    workflowVersionId?: string;
  } {
    if (isWorkflowToolName(name)) {
      return {
        toolKind: 'workflow',
        workflowVersionId: parseWorkflowToolName(name) ?? undefined,
      };
    }

    const [pluginCode, toolCode] = name.split('__');
    return {
      toolKind: 'plugin',
      pluginCode,
      toolCode,
    };
  }

  private maskPreviewArgs(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const sensitiveKeys = new Set([
      'token',
      'apiKey',
      'authorization',
      'password',
      'secret',
      'cookie',
    ]);

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        sensitiveKeys.has(key) ? '***' : val,
      ]),
    );
  }
}
