import { Injectable } from '@nestjs/common';
import { ToolCall, ToolResult } from '../../../shared/types/agent';
import { ToolExecutor } from '../../../shared/types/runtime';

type ToolHandler = (args: Record<string, unknown>) => Promise<string> | string;

@Injectable()
export class ToolRunner implements ToolExecutor {
  private readonly handlers = new Map<string, ToolHandler>();

  register(name: string, handler: ToolHandler) {
    this.handlers.set(name, handler);
  }

  async execute(input: {
    toolCall: ToolCall;
    context: unknown;
  }): Promise<ToolResult> {
    const { toolCall } = input;
    const handler = this.handlers.get(toolCall.function.name);
    if (!handler) {
      return {
        toolCallId: toolCall.id,
        output: JSON.stringify({
          error: `Tool not registered: ${toolCall.function.name}`,
        }),
      };
    }

    const args = this.parseArguments(toolCall.function.arguments);
    const result = await handler(args);
    return {
      toolCallId: toolCall.id,
      output: result,
    };
  }

  private parseArguments(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { value: parsed };
    } catch {
      return { value: raw };
    }
  }
}
