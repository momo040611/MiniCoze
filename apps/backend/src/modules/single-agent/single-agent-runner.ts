import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RuntimeEvent, ToolCall } from '../../shared/types/agent';
import type {
  AgentExecutionInput,
  AgentExecutionStrategy,
} from '../../shared/types/runtime';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';

@Injectable()
export class SingleAgentRunner implements AgentExecutionStrategy {
  readonly mode = 'single_agent' as const;

  constructor(private readonly aiGateway: AiGatewayService) {}

  async *stream({
    context,
    messages,
    toolExecutor,
  }: AgentExecutionInput): AsyncGenerator<RuntimeEvent, string, void> {
    const tools = context.agentConfig.tools ?? [];

    for (;;) {
      const assistantMessageId = randomUUID();
      const stream = this.aiGateway.chatStream({
        messages,
        model: context.agentConfig.model,
        temperature: context.agentConfig.temperature,
        maxTokens: context.agentConfig.maxTokens,
        tools,
      });

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
        const parsedArgs = this.safeParse(toolCall.function.arguments);
        yield {
          type: 'tool.call.created',
          runId: context.runId,
          toolCallId: toolCall.id,
          name: toolCall.function.name,
          args: parsedArgs,
        };

        const result = await toolExecutor.execute({
          toolCall,
          context,
        });
        yield {
          type: 'tool.call.completed',
          runId: context.runId,
          toolCallId: toolCall.id,
          name: toolCall.function.name,
          result: result.output,
        };

        messages.push({
          role: 'tool',
          content: result.output,
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
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
}
