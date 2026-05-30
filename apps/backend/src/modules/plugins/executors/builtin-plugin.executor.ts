import { Injectable } from '@nestjs/common';

type BuiltinToolHandler = (
  args: Record<string, unknown>,
) => Promise<unknown> | unknown;

@Injectable()
export class BuiltinPluginExecutor {
  private readonly handlers = new Map<string, BuiltinToolHandler>();

  constructor() {
    this.register('echo_text', async (args) => ({
      text:
        typeof args.text === 'string'
          ? args.text
          : typeof args.value === 'string'
            ? args.value
            : JSON.stringify(args),
    }));
    this.register('time_now', async () => ({
      now: new Date().toISOString(),
    }));
  }

  register(name: string, handler: BuiltinToolHandler): void {
    this.handlers.set(name, handler);
  }

  supports(type: string): boolean {
    return type === 'BUILTIN';
  }

  async execute(input: {
    functionName: string;
    toolCode: string;
    handlerKey?: string;
    args: Record<string, unknown>;
  }): Promise<unknown> {
    const candidates = [
      input.handlerKey,
      input.functionName,
      input.toolCode,
    ].filter((item): item is string => Boolean(item));

    for (const key of candidates) {
      const handler = this.handlers.get(key);
      if (handler) {
        return handler(input.args);
      }
    }

    throw new Error(`Builtin tool not registered: ${input.functionName}`);
  }
}
