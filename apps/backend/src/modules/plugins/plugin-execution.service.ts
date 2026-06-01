import { Injectable } from '@nestjs/common';
import { type ToolCall, ToolResult } from '../../shared/types/agent';
import { RuntimeContext, ToolExecutor } from '../../shared/types/runtime';
import { BuiltinPluginExecutor } from './executors/builtin-plugin.executor';
import { HttpPluginExecutor } from './executors/http-plugin.executor';
import { PluginInvocationService } from './plugin-invocation.service';
import { PluginResolverService } from './plugin-resolver.service';
import {
  type AgentPluginBindingConfig,
  type PluginToolTestResponse,
  type PluginEntityForToolTest,
  type PluginToolEntityForToolTest,
  type ResolvedPluginTool,
} from './types/plugin.types';
import { PluginSchemaValidator } from './validators/plugin-schema.validator';

type PluginExecutionTarget =
  | ResolvedPluginTool
  | { plugin: PluginEntityForToolTest; tool: PluginToolEntityForToolTest };

@Injectable()
export class PluginExecutionService implements ToolExecutor {
  constructor(
    private readonly pluginResolver: PluginResolverService,
    private readonly schemaValidator: PluginSchemaValidator,
    private readonly invocationService: PluginInvocationService,
    private readonly builtinExecutor: BuiltinPluginExecutor,
    private readonly httpExecutor: HttpPluginExecutor,
  ) {}

  async execute(input: {
    toolCall: ToolCall;
    context: RuntimeContext;
  }): Promise<ToolResult> {
    const target = await this.pluginResolver.resolve(
      input.toolCall.function.name,
      input.context,
    );
    const parsedArgs = this.parseArguments(input.toolCall.function.arguments);
    const mergedArgs = this.mergeArgs(
      target.tool.code,
      (target.binding.config ?? null) as AgentPluginBindingConfig | null,
      parsedArgs,
    );

    this.schemaValidator.validateInput(
      (target.tool.inputSchema ?? {}) as Record<string, unknown>,
      mergedArgs,
    );

    const invocation = await this.invocationService.start({
      target,
      runId: input.context.runId,
      conversationId: input.context.conversationId,
      args: mergedArgs,
    });

    try {
      const output = await this.dispatchExecution(
        input.toolCall.function.name,
        target,
        mergedArgs,
        input.context,
      );
      const maskedOutput = await this.invocationService.completeSuccess(
        invocation,
        target,
        output,
      );

      return {
        toolCallId: input.toolCall.id,
        output: this.serializeOutput(output),
        metadata: target.metadata,
        maskedArgs: invocation.argsSummary,
        maskedOutput,
      };
    } catch (error) {
      const maskedError = await this.invocationService.completeFailure(
        invocation,
        target,
        error,
      );
      throw new Error(maskedError);
    }
  }

  async testTool(input: {
    plugin: PluginEntityForToolTest;
    tool: PluginToolEntityForToolTest;
    args?: Record<string, unknown>;
    bindingConfig?: AgentPluginBindingConfig | null;
  }): Promise<PluginToolTestResponse> {
    const startedAt = Date.now();
    const rawArgs = input.args ?? {};
    const mergedArgs = this.mergeArgs(
      input.tool.code,
      input.bindingConfig ?? null,
      rawArgs,
    );
    let invocation: Awaited<
      ReturnType<PluginInvocationService['startToolTest']>
    > | null = null;

    try {
      invocation = await this.invocationService.startToolTest({
        plugin: input.plugin,
        tool: input.tool,
        args: mergedArgs,
      });

      this.schemaValidator.validateInput(
        (input.tool.inputSchema ?? {}) as Record<string, unknown>,
        mergedArgs,
      );

      const output = await this.dispatchExecution(
        `${input.plugin.code}__${input.tool.code}`,
        {
          plugin: input.plugin,
          tool: input.tool,
        },
        mergedArgs,
        undefined,
      );

      await this.invocationService.completeSuccess(
        invocation,
        {
          plugin: input.plugin,
          tool: input.tool,
        },
        output,
      );

      return {
        success: true,
        output,
        error: null,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (invocation) {
        await this.invocationService.completeFailure(
          invocation,
          {
            plugin: input.plugin,
            tool: input.tool,
          },
          error,
        );
      }
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : '工具测试失败',
        durationMs: Date.now() - startedAt,
      };
    }
  }

  private async dispatchExecution(
    functionName: string,
    target: PluginExecutionTarget,
    args: Record<string, unknown>,
    context: RuntimeContext | undefined,
  ): Promise<unknown> {
    if (this.builtinExecutor.supports(target.plugin.type)) {
      const handlerKey =
        target.tool.meta &&
        typeof target.tool.meta === 'object' &&
        !Array.isArray(target.tool.meta) &&
        typeof target.tool.meta.handler === 'string'
          ? target.tool.meta.handler
          : undefined;
      return this.builtinExecutor.execute({
        functionName,
        toolCode: target.tool.code,
        handlerKey,
        args,
        context,
      });
    }

    if (this.httpExecutor.supports(target.plugin.type)) {
      return this.httpExecutor.execute();
    }

    throw new Error(`Unsupported plugin type: ${target.plugin.type}`);
  }

  private parseArguments(raw: string): Record<string, unknown> {
    try {
      if (!raw || !raw.trim()) {
        return {};
      }
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new Error('插件参数必须是 JSON 对象');
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : '插件参数解析失败',
      );
    }
  }

  private mergeArgs(
    toolCode: string,
    config: AgentPluginBindingConfig | null,
    rawArgs: Record<string, unknown>,
  ): Record<string, unknown> {
    const defaults = config?.defaults?.[toolCode] ?? {};
    const forcedOverrides = config?.forcedOverrides?.[toolCode] ?? {};
    return {
      ...defaults,
      ...rawArgs,
      ...forcedOverrides,
    };
  }

  private serializeOutput(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }
}
