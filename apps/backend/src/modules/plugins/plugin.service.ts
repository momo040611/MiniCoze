import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { createPaginatedData } from '../../common/types/pagination-response.type';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreatePluginDto } from './dto/create-plugin.dto';
import { PluginQueryDto } from './dto/plugin-query.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';
import {
  type PluginDetailResponse,
  type PluginToolResponse,
} from './types/plugin.types';

@Injectable()
export class PluginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private get db(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
  }

  async create(
    userId: string,
    dto: CreatePluginDto,
  ): Promise<PluginDetailResponse> {
    await this.workspaceAccessService.ensureCanManage(userId, dto.workspaceId);

    const existing = await this.db.pluginDefinition.findFirst({
      where: {
        workspaceId: dto.workspaceId,
        code: dto.code,
      },
    });

    if (existing) {
      throw new BusinessException(
        '插件编码已存在',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const plugin = await this.db.pluginDefinition.create({
      data: {
        workspaceId: dto.workspaceId,
        creatorId: userId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        iconUrl: dto.iconUrl,
        type: dto.type ?? 'BUILTIN',
        version: dto.version ?? 'v1.0.0',
        isBuiltin: dto.isBuiltin ?? false,
        maskStrategy: (dto.maskStrategy ?? undefined) as any,
        invocationEnabled: dto.invocationEnabled ?? true,
      },
      include: {
        tools: true,
        credentials: true,
      },
    });

    return this.toPluginDetailResponse(plugin);
  }

  async findByWorkspace(userId: string, query: PluginQueryDto) {
    await this.workspaceAccessService.ensureMember(userId, query.workspaceId);

    const where: any = {
      workspaceId: query.workspaceId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword, mode: 'insensitive' as any } },
              { code: { contains: query.keyword, mode: 'insensitive' as any } },
              {
                description: {
                  contains: query.keyword,
                  mode: 'insensitive' as any,
                },
              },
            ],
          }
        : {}),
    };

    const [plugins, total] = await this.db.$transaction([
      this.db.pluginDefinition.findMany({
        where,
        include: {
          tools: true,
          credentials: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.pluginDefinition.count({ where }),
    ]);

    return createPaginatedData({
      list: plugins.map((plugin: any) => this.toPluginDetailResponse(plugin)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async findOneForUser(
    userId: string,
    pluginId: string,
  ): Promise<PluginDetailResponse> {
    const plugin = await this.findPluginOrThrow(pluginId);
    await this.workspaceAccessService.ensureMember(userId, plugin.workspaceId);
    return this.toPluginDetailResponse(plugin);
  }

  async update(
    userId: string,
    pluginId: string,
    dto: UpdatePluginDto,
  ): Promise<PluginDetailResponse> {
    const plugin = await this.findPluginOrThrow(pluginId);
    await this.workspaceAccessService.ensureCanManage(userId, plugin.workspaceId);

    if (dto.code && dto.code !== plugin.code) {
      const existing = await this.db.pluginDefinition.findFirst({
        where: {
          workspaceId: plugin.workspaceId,
          code: dto.code,
          id: { not: pluginId },
        },
      });
      if (existing) {
        throw new BusinessException(
          '插件编码已存在',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updated = await this.db.pluginDefinition.update({
      where: { id: pluginId },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        iconUrl: dto.iconUrl,
        type: dto.type,
        status: dto.status,
        version: dto.version,
        isBuiltin: dto.isBuiltin,
        maskStrategy: (dto.maskStrategy ?? undefined) as any,
        invocationEnabled: dto.invocationEnabled,
      },
      include: {
        tools: true,
        credentials: true,
      },
    });

    return this.toPluginDetailResponse(updated);
  }

  async activate(userId: string, pluginId: string) {
    return this.update(userId, pluginId, { status: 'ACTIVE' });
  }

  async disable(userId: string, pluginId: string) {
    return this.update(userId, pluginId, { status: 'DISABLED' });
  }

  async findPluginOrThrow(pluginId: string): Promise<any> {
    const plugin = await this.db.pluginDefinition.findUnique({
      where: { id: pluginId },
      include: {
        tools: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        credentials: true,
      },
    });

    if (!plugin) {
      throw new BusinessException(
        '插件不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return plugin;
  }

  private toPluginToolResponse(tool: any): PluginToolResponse {
    return {
      id: tool.id,
      code: tool.code,
      name: tool.name,
      description: tool.description,
      status: tool.status,
      inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
      outputSchema: (tool.outputSchema ?? null) as Record<string, unknown> | null,
      meta: (tool.meta ?? null) as Record<string, unknown> | null,
      createdAt: formatShanghaiDateTime(tool.createdAt),
      updatedAt: formatShanghaiDateTime(tool.updatedAt),
    };
  }

  private toPluginDetailResponse(plugin: any): PluginDetailResponse {
    const credentials = Array.isArray(plugin.credentials) ? plugin.credentials : [];
    return {
      id: plugin.id,
      workspaceId: plugin.workspaceId,
      creatorId: plugin.creatorId,
      code: plugin.code,
      name: plugin.name,
      description: plugin.description,
      iconUrl: plugin.iconUrl,
      type: plugin.type,
      status: plugin.status,
      version: plugin.version,
      isBuiltin: Boolean(plugin.isBuiltin),
      invocationEnabled: Boolean(plugin.invocationEnabled),
      maskStrategy: (plugin.maskStrategy ?? null) as Record<string, unknown> | null,
      tools: Array.isArray(plugin.tools)
        ? plugin.tools.map((tool: any) => this.toPluginToolResponse(tool))
        : [],
      credentialSummary: {
        count: credentials.length,
        activeCount: credentials.filter((item: any) => item.status === 'ACTIVE')
          .length,
      },
      createdAt: formatShanghaiDateTime(plugin.createdAt),
      updatedAt: formatShanghaiDateTime(plugin.updatedAt),
    };
  }
}
