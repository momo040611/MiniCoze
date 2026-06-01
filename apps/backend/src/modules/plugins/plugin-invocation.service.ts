import { HttpStatus, Injectable } from '@nestjs/common';
import { type PluginInvocation, type Prisma } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { PluginMaskerService } from './mask/plugin-masker.service';
import { PluginInvocationQueryDto } from './dto/plugin-invocation-query.dto';
import {
  type PluginMaskStrategy,
  type PluginInvocationResponse,
  type PluginEntityForToolTest,
  type PluginInvocationTarget,
  type PluginToolEntityForToolTest,
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
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async start(input: {
    target: ResolvedPluginTool;
    runId: string;
    conversationId: string | null;
    args: Record<string, unknown>;
  }): Promise<InvocationContext> {
    return this.createInvocation({
      pluginId: input.target.plugin.id,
      agentId: input.target.binding.agentId,
      conversationId: input.conversationId,
      runId: input.runId,
      toolCode: input.target.tool.code,
      maskStrategy: input.target.plugin.maskStrategy,
      args: input.args,
    });
  }

  async startToolTest(input: {
    plugin: PluginEntityForToolTest;
    tool: PluginToolEntityForToolTest;
    args: Record<string, unknown>;
  }): Promise<InvocationContext> {
    return this.createInvocation({
      pluginId: input.plugin.id,
      agentId: null,
      conversationId: null,
      runId: `test:${input.plugin.id}:${input.tool.code}:${Date.now()}`,
      toolCode: input.tool.code,
      maskStrategy: input.plugin.maskStrategy,
      args: input.args,
    });
  }

  private async createInvocation(input: {
    pluginId: string;
    agentId: string | null;
    conversationId: string | null;
    runId: string;
    toolCode: string;
    maskStrategy?: unknown;
    args: Record<string, unknown>;
  }): Promise<InvocationContext> {
    const strategy = this.getMaskStrategy(input.maskStrategy);
    const argsSummary = this.masker.summarizeInput(input.args, strategy);
    const created = await this.prisma.pluginInvocation.create({
      data: {
        pluginId: input.pluginId,
        agentId: input.agentId,
        conversationId: input.conversationId,
        runId: input.runId,
        toolCode: input.toolCode,
        status: 'RUNNING',
        argsSummary: argsSummary as Prisma.InputJsonValue,
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
    target: PluginInvocationTarget,
    output: unknown,
  ): Promise<unknown> {
    const strategy = this.getMaskStrategy(target.plugin.maskStrategy);
    const outputSummary = this.masker.summarizeOutput(output, strategy);
    await this.prisma.pluginInvocation.update({
      where: {
        id: context.invocationId,
      },
      data: {
        status: 'SUCCESS',
        outputSummary: outputSummary as Prisma.InputJsonValue,
        finishedAt: new Date(),
        durationMs: Date.now() - context.startedAt,
      },
    });
    return outputSummary;
  }

  async completeFailure(
    context: InvocationContext,
    target: PluginInvocationTarget,
    error: unknown,
  ): Promise<string> {
    const strategy = this.getMaskStrategy(target.plugin.maskStrategy);
    const errorSummary = this.masker.summarizeError(error, strategy);
    await this.prisma.pluginInvocation.update({
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

  async findByPlugin(
    userId: string,
    pluginId: string,
    query: PluginInvocationQueryDto,
  ) {
    await this.workspaceAccessService.ensureMember(userId, query.workspaceId);

    const plugin = await this.prisma.pluginDefinition.findFirst({
      where: {
        id: pluginId,
        workspaceId: query.workspaceId,
      },
      select: {
        id: true,
      },
    });

    if (!plugin) {
      throw new BusinessException(
        '插件不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const where: Prisma.PluginInvocationWhereInput = {
      pluginId,
    };

    const [records, total] = await this.prisma.$transaction([
      this.prisma.pluginInvocation.findMany({
        where,
        orderBy: {
          startedAt: 'desc',
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.pluginInvocation.count({ where }),
    ]);

    return createPaginatedData({
      list: records.map((record) => this.toInvocationResponse(record)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  private getMaskStrategy(value: unknown): PluginMaskStrategy | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return value;
  }

  private toInvocationResponse(
    record: PluginInvocation,
  ): PluginInvocationResponse {
    return {
      id: record.id,
      pluginId: record.pluginId,
      agentId: record.agentId ?? null,
      conversationId: record.conversationId ?? null,
      runId: record.runId,
      toolCode: record.toolCode,
      status: record.status,
      argsSummary: record.argsSummary ?? null,
      outputSummary: record.outputSummary ?? null,
      errorSummary: record.errorSummary ?? null,
      durationMs: record.durationMs ?? null,
      startedAt: formatShanghaiDateTime(record.startedAt),
      finishedAt: record.finishedAt
        ? formatShanghaiDateTime(record.finishedAt)
        : null,
    };
  }
}
