import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreatePluginToolDto } from './dto/create-plugin-tool.dto';
import { UpdatePluginToolDto } from './dto/update-plugin-tool.dto';
import { PluginService } from './plugin.service';
import { type PluginToolResponse } from './types/plugin.types';

@Injectable()
export class PluginToolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly pluginService: PluginService,
  ) {}

  private get db(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
  }

  async create(
    userId: string,
    pluginId: string,
    dto: CreatePluginToolDto,
  ): Promise<PluginToolResponse> {
    const plugin = await this.pluginService.findPluginOrThrow(pluginId);
    await this.workspaceAccessService.ensureCanManage(userId, plugin.workspaceId);

    this.validateSchema(dto.inputSchema, 'inputSchema');
    if (dto.outputSchema) {
      this.validateLooseObject(dto.outputSchema, 'outputSchema');
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
        inputSchema: dto.inputSchema as any,
        outputSchema: (dto.outputSchema ?? undefined) as any,
        meta: (dto.meta ?? undefined) as any,
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
    const plugin = await this.pluginService.findPluginOrThrow(pluginId);
    await this.workspaceAccessService.ensureCanManage(userId, plugin.workspaceId);

    const tool = await this.findToolOrThrow(pluginId, toolId);

    if (dto.inputSchema) {
      this.validateSchema(dto.inputSchema, 'inputSchema');
    }
    if (dto.outputSchema) {
      this.validateLooseObject(dto.outputSchema, 'outputSchema');
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
        inputSchema: (dto.inputSchema ?? undefined) as any,
        outputSchema: (dto.outputSchema ?? undefined) as any,
        meta: (dto.meta ?? undefined) as any,
      },
    });

    return this.toPluginToolResponse(updated);
  }

  async findToolOrThrow(pluginId: string, toolId: string): Promise<any> {
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

  private validateSchema(schema: Record<string, unknown>, fieldName: string) {
    this.validateLooseObject(schema, fieldName);
    if (schema.type !== 'object') {
      throw new BusinessException(
        `${fieldName} 必须声明 type 为 object`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private validateLooseObject(value: Record<string, unknown>, fieldName: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BusinessException(
        `${fieldName} 必须是对象`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
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
}
