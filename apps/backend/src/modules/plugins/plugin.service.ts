import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import {
  createPaginatedData,
  type PaginatedData,
} from '../../common/types/pagination-response.type';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { BUILTIN_PLUGIN_DEFINITIONS } from './constants/builtin-plugin-definitions';
import { CreatePluginDto } from './dto/create-plugin.dto';
import { PluginQueryDto } from './dto/plugin-query.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';
import {
  type PluginDetailResponse,
  type PluginToolResponse,
} from './types/plugin.types';

const pluginDetailInclude = {
  tools: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  credentials: true,
} as const satisfies Prisma.PluginDefinitionInclude;

type PluginDetailEntity = Prisma.PluginDefinitionGetPayload<{
  include: typeof pluginDetailInclude;
}>;

type PluginToolEntity = PluginDetailEntity['tools'][number];

@Injectable()
export class PluginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async create(
    userId: string,
    dto: CreatePluginDto,
  ): Promise<PluginDetailResponse> {
    await this.workspaceAccessService.ensureCanManage(userId, dto.workspaceId);

    const existing = await this.prisma.pluginDefinition.findFirst({
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

    const plugin = await this.prisma.pluginDefinition.create({
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
        maskStrategy: (dto.maskStrategy ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        invocationEnabled: dto.invocationEnabled ?? true,
      },
      include: pluginDetailInclude,
    });

    return this.toPluginDetailResponse(plugin);
  }

  async findByWorkspace(
    userId: string,
    query: PluginQueryDto,
  ): Promise<PaginatedData<PluginDetailResponse>> {
    await this.workspaceAccessService.ensureMember(userId, query.workspaceId);
    await this.ensureBuiltinPlugins(userId, query.workspaceId);

    const where: Prisma.PluginDefinitionWhereInput = {
      workspaceId: query.workspaceId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                name: {
                  contains: query.keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                code: {
                  contains: query.keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                description: {
                  contains: query.keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [plugins, total] = await this.prisma.$transaction([
      this.prisma.pluginDefinition.findMany({
        where,
        include: pluginDetailInclude,
        orderBy: {
          updatedAt: 'desc',
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.pluginDefinition.count({ where }),
    ]);

    return createPaginatedData({
      list: plugins.map((plugin) => this.toPluginDetailResponse(plugin)),
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
    await this.ensureBuiltinPlugins(userId, plugin.workspaceId);
    await this.workspaceAccessService.ensureMember(userId, plugin.workspaceId);
    return this.toPluginDetailResponse(plugin);
  }

  async update(
    userId: string,
    pluginId: string,
    dto: UpdatePluginDto,
  ): Promise<PluginDetailResponse> {
    const plugin = await this.findPluginOrThrow(pluginId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      plugin.workspaceId,
    );

    if (dto.code && dto.code !== plugin.code) {
      const existing = await this.prisma.pluginDefinition.findFirst({
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

    const updated = await this.prisma.pluginDefinition.update({
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
        maskStrategy: (dto.maskStrategy ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        invocationEnabled: dto.invocationEnabled,
      },
      include: pluginDetailInclude,
    });

    return this.toPluginDetailResponse(updated);
  }

  async activate(userId: string, pluginId: string) {
    return this.update(userId, pluginId, { status: 'ACTIVE' });
  }

  async disable(userId: string, pluginId: string) {
    return this.update(userId, pluginId, { status: 'DISABLED' });
  }

  async findPluginOrThrow(pluginId: string): Promise<PluginDetailEntity> {
    const plugin = await this.prisma.pluginDefinition.findUnique({
      where: { id: pluginId },
      include: pluginDetailInclude,
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

  async ensureBuiltinPlugins(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const existingPlugins = await this.prisma.pluginDefinition.findMany({
      where: {
        workspaceId,
        isBuiltin: true,
      },
      select: {
        id: true,
        code: true,
      },
    });

    const existingCodeSet = new Set(
      existingPlugins.map((plugin) => plugin.code),
    );

    for (const definition of BUILTIN_PLUGIN_DEFINITIONS) {
      if (existingCodeSet.has(definition.code)) {
        const existing = existingPlugins.find(
          (item) => item.code === definition.code,
        );
        if (existing?.id) {
          await this.ensureBuiltinTools(existing.id, definition);
        }
        continue;
      }

      const created = await this.prisma.pluginDefinition.create({
        data: {
          workspaceId,
          creatorId: userId,
          code: definition.code,
          name: definition.name,
          description: definition.description,
          type: 'BUILTIN',
          status: 'ACTIVE',
          version: definition.version,
          isBuiltin: true,
          invocationEnabled: true,
        },
      });

      await this.ensureBuiltinTools(created.id, definition);
    }
  }

  private async ensureBuiltinTools(
    pluginId: string,
    definition: (typeof BUILTIN_PLUGIN_DEFINITIONS)[number],
  ): Promise<void> {
    const existingTools = await this.prisma.pluginTool.findMany({
      where: {
        pluginId,
      },
      select: {
        code: true,
      },
    });
    const existingToolCodeSet = new Set(existingTools.map((tool) => tool.code));

    for (const tool of definition.tools) {
      if (existingToolCodeSet.has(tool.code)) {
        continue;
      }

      await this.prisma.pluginTool.create({
        data: {
          pluginId,
          code: tool.code,
          name: tool.name,
          description: tool.description,
          status: 'ACTIVE',
          inputSchema: tool.inputSchema as Prisma.InputJsonValue,
          outputSchema: tool.outputSchema as Prisma.InputJsonValue,
          meta: {
            handler: tool.handler,
          },
        },
      });
    }
  }

  private toPluginToolResponse(tool: PluginToolEntity): PluginToolResponse {
    return {
      id: tool.id,
      code: tool.code,
      name: tool.name,
      description: tool.description,
      status: tool.status,
      inputSchema: (tool.inputSchema ?? {}) as unknown as Record<
        string,
        unknown
      >,
      outputSchema: (tool.outputSchema ?? null) as Record<
        string,
        unknown
      > | null,
      meta: (tool.meta ?? null) as unknown as Record<string, unknown> | null,
      createdAt: formatShanghaiDateTime(tool.createdAt),
      updatedAt: formatShanghaiDateTime(tool.updatedAt),
    };
  }

  private toPluginDetailResponse(
    plugin: PluginDetailEntity,
  ): PluginDetailResponse {
    const credentials = plugin.credentials ?? [];
    return {
      id: plugin.id,
      workspaceId: plugin.workspaceId,
      creatorId: plugin.creatorId,
      code: plugin.code,
      name: plugin.name,
      description: plugin.description ?? null,
      iconUrl: plugin.iconUrl ?? null,
      type: plugin.type,
      status: plugin.status,
      version: plugin.version,
      isBuiltin: Boolean(plugin.isBuiltin),
      invocationEnabled: Boolean(plugin.invocationEnabled),
      maskStrategy: (plugin.maskStrategy ?? null) as unknown as Record<
        string,
        unknown
      > | null,
      tools: plugin.tools.map((tool) => this.toPluginToolResponse(tool)),
      credentialSummary: {
        count: credentials.length,
        activeCount: credentials.filter((item) => item.status === 'ACTIVE')
          .length,
      },
      createdAt: formatShanghaiDateTime(plugin.createdAt),
      updatedAt: formatShanghaiDateTime(plugin.updatedAt),
    };
  }
}
