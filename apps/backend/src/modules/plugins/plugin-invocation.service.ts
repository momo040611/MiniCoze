import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PluginMaskerService } from './mask/plugin-masker.service';
import {
  type PluginMaskStrategy,
  type ResolvedPluginTool,
} from './types/plugin.types';

interface InvocationContext {
  invocationId: string;
  startedAt: number;
  argsSummary: unknown;
}

@Injectable()
export class PluginInvocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masker: PluginMaskerService,
  ) {}

  private get db(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
  }

  async start(input: {
    target: ResolvedPluginTool;
    runId: string;
    conversationId: string;
    args: Record<string, unknown>;
  }): Promise<InvocationContext> {
    const strategy = this.getMaskStrategy(input.target.plugin.maskStrategy);
    const argsSummary = this.masker.summarizeInput(input.args, strategy);
    const created = await this.db.pluginInvocation.create({
      data: {
        pluginId: input.target.plugin.id,
        agentId: input.target.binding.agentId,
        conversationId: input.conversationId,
        runId: input.runId,
        toolCode: input.target.tool.code,
        status: 'RUNNING',
        argsSummary: argsSummary as any,
      },
    });

    return {
      invocationId: created.id,
      startedAt: Date.now(),
      argsSummary,
    };
  }

  async completeSuccess(
    context: InvocationContext,
    target: ResolvedPluginTool,
    output: unknown,
  ): Promise<unknown> {
    const strategy = this.getMaskStrategy(target.plugin.maskStrategy);
    const outputSummary = this.masker.summarizeOutput(output, strategy);
    await this.db.pluginInvocation.update({
      where: {
        id: context.invocationId,
      },
      data: {
        status: 'SUCCESS',
        outputSummary: outputSummary as any,
        finishedAt: new Date(),
        durationMs: Date.now() - context.startedAt,
      },
    });
    return outputSummary;
  }

  async completeFailure(
    context: InvocationContext,
    target: ResolvedPluginTool,
    error: unknown,
  ): Promise<string> {
    const strategy = this.getMaskStrategy(target.plugin.maskStrategy);
    const errorSummary = this.masker.summarizeError(error, strategy);
    await this.db.pluginInvocation.update({
      where: {
        id: context.invocationId,
      },
      data: {
        status: 'FAILED',
        errorSummary,
        finishedAt: new Date(),
        durationMs: Date.now() - context.startedAt,
      },
    });
    return errorSummary;
  }

  private getMaskStrategy(value: unknown): PluginMaskStrategy | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return value as PluginMaskStrategy;
  }
}
