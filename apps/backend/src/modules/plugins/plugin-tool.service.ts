import { HttpStatus, Injectable } from '@nestjs/common';
import type { PluginDefinition, PluginTool, Prisma } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreatePluginToolDto } from './dto/create-plugin-tool.dto';
import { TestPluginToolDto } from './dto/test-plugin-tool.dto';
import { UpdatePluginToolDto } from './dto/update-plugin-tool.dto';
import { PluginExecutionService } from './plugin-execution.service';
import { PluginService } from './plugin.service';
import {
  type PluginToolResponse,
  type PluginToolTestResponse,
} from './types/plugin.types';
import { PluginSchemaValidator } from './validators/plugin-schema.validator';

@Injectable()
export class PluginToolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly pluginService: PluginService,
    private readonly schemaValidator: PluginSchemaValidator,
    private readonly pluginExecutionService: PluginExecutionService,
  ) {}

  private get db(): PrismaService {
    return this.prisma;
  }

  private asJsonRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  async create(
    userId: string,
    pluginId: string,
    dto: CreatePluginToolDto,
  ): Promise<PluginToolResponse> {
    const plugin: PluginDefinition =
      await this.pluginService.findPluginOrThrow(pluginId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      plugin.workspaceId,
    );

    this.schemaValidator.validateDefinition(dto.inputSchema);
    if (
      dto.outputSchema &&
      (typeof dto.outputSchema !== 'object' || Array.isArray(dto.outputSchema))
    ) {
      throw new BusinessException(
        'outputSchema 必须是对象',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.db.pluginTool.findFirst({
      where: {
        pluginId,
        code: dto.code,
      },
    });

    if (existing) {
      throw new BusinessException(
        '插件工具编码已存在',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const tool = await this.db.pluginTool.create({
      data: {
        pluginId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        inputSchema: dto.inputSchema as Prisma.InputJsonValue,
        outputSchema: (dto.outputSchema ?? undefined) as Prisma.InputJsonValue,
        meta: (dto.meta ?? undefined) as Prisma.InputJsonValue,
      },
    });

    return this.toPluginToolResponse(tool);
  }

  async update(
    userId: string,
    pluginId: string,
    toolId: string,
    dto: UpdatePluginToolDto,
  ): Promise<PluginToolResponse> {
    const plugin: PluginDefinition =
      await this.pluginService.findPluginOrThrow(pluginId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      plugin.workspaceId,
    );

    const tool = await this.findToolOrThrow(pluginId, toolId);

    if (dto.inputSchema) {
      this.schemaValidator.validateDefinition(dto.inputSchema);
    }
    if (
      dto.outputSchema &&
      (typeof dto.outputSchema !== 'object' || Array.isArray(dto.outputSchema))
    ) {
      throw new BusinessException(
        'outputSchema 必须是对象',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.code && dto.code !== tool.code) {
      const existing = await this.db.pluginTool.findFirst({
        where: {
          pluginId,
          code: dto.code,
          id: { not: toolId },
        },
      });
      if (existing) {
        throw new BusinessException(
          '插件工具编码已存在',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updated = await this.db.pluginTool.update({
      where: { id: toolId },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        inputSchema: (dto.inputSchema ?? undefined) as Prisma.InputJsonValue,
        outputSchema: (dto.outputSchema ?? undefined) as Prisma.InputJsonValue,
        meta: (dto.meta ?? undefined) as Prisma.InputJsonValue,
      },
    });

    return this.toPluginToolResponse(updated);
  }

  async findToolOrThrow(pluginId: string, toolId: string): Promise<PluginTool> {
    const tool = await this.db.pluginTool.findFirst({
      where: {
        id: toolId,
        pluginId,
      },
    });

    if (!tool) {
      throw new BusinessException(
        '插件工具不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return tool;
  }

  async test(
    userId: string,
    pluginId: string,
    toolId: string,
    dto: TestPluginToolDto,
  ): Promise<PluginToolTestResponse> {
    const plugin: PluginDefinition =
      await this.pluginService.findPluginOrThrow(pluginId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      plugin.workspaceId,
    );
    const tool = await this.findToolOrThrow(pluginId, toolId);

    return this.pluginExecutionService.testTool({
      plugin,
      tool,
      args: dto.arguments ?? {},
      bindingConfig: dto.bindingConfig ?? null,
    });
  }

  private toPluginToolResponse(tool: PluginTool): PluginToolResponse {
    return {
      id: tool.id,
      code: tool.code,
      name: tool.name,
      description: tool.description,
      status: tool.status,
      inputSchema: this.asJsonRecord(tool.inputSchema) ?? {},
      outputSchema: this.asJsonRecord(tool.outputSchema) ?? null,
      meta: this.asJsonRecord(tool.meta) ?? null,
      createdAt: formatShanghaiDateTime(tool.createdAt),
      updatedAt: formatShanghaiDateTime(tool.updatedAt),
    };
  }
}
