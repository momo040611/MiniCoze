import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AgentPluginBindingStatus,
  AgentStatus,
  KnowledgeBaseStatus,
  PluginStatus,
  Prisma,
  PublishAction,
  PublishChannelType,
  PublishTargetType,
} from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import type {
  RuntimeKnowledgeBindingConfig,
  ToolDefinition,
} from '../../shared/types/agent';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { buildWorkflowToolDefinition } from '../workflow/workflow-tool.util';
import { OfflineAgentDto } from './dto/offline-agent.dto';
import { PublishAgentDto } from './dto/publish-agent.dto';
import { PublishRecordService } from './publish-record.service';
import { RollbackAgentDto } from './dto/rollback-agent.dto';
import { PublishChannelService } from './publish-channel.service';
import {
  AgentPublishSnapshot,
  AgentVersionListItem,
  OfflineAgentResponse,
  PublishAgentResponse,
  PublishCheckItem,
  PublishCheckResponse,
  PublishRecordListItem,
  RollbackAgentResponse,
} from './types/publish.types';

type PublishAgent = Prisma.AgentGetPayload<{
  include: {
    workflows: {
      include: {
        workflow: true;
        workflowVersion: true;
      };
    };
    pluginBindings: {
      include: {
        plugin: {
          include: {
            tools: {
              where: {
                status: 'ACTIVE';
              };
              orderBy: {
                createdAt: 'asc';
              };
            };
          };
        };
      };
    };
    knowledgeBaseBindings: {
      include: {
        knowledgeBase: true;
      };
    };
  };
}>;

@Injectable()
export class PublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly publishChannelService: PublishChannelService,
    private readonly publishRecordService: PublishRecordService,
  ) {}

  async checkAgent(
    userId: string,
    agentId: string,
  ): Promise<PublishCheckResponse> {
    const agent = await this.findAgentForPublishOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    const items = this.buildPublishCheckItems(agent);

    return {
      passed: items.every((item) => item.passed),
      items,
    };
  }

  async publishAgent(
    userId: string,
    agentId: string,
    dto: PublishAgentDto,
  ): Promise<PublishAgentResponse> {
    const agent = await this.findAgentForPublishOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    this.assertAgentCanPublish(agent);
    const snapshot = this.buildAgentSnapshot(agent);

    const result = await this.prisma.$transaction(async (tx) => {
      const latestVersion = await tx.agentVersion.findFirst({
        where: { agentId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = (latestVersion?.version ?? 0) + 1;
      const publishedAt = new Date();

      const createdVersion = await tx.agentVersion.create({
        data: {
          agentId,
          createdBy: userId,
          version: nextVersion,
          snapshot: this.toInputJsonValue(snapshot),
          changelog: dto.changelog,
          isPublished: true,
          publishedAt,
        },
      });

      await tx.agent.update({
        where: { id: agentId },
        data: {
          currentVersionId: createdVersion.id,
          status: AgentStatus.ACTIVE,
        },
      });

      await this.publishRecordService.createAgentRecord(tx, {
        workspaceId: agent.workspaceId,
        agentId,
        versionId: createdVersion.id,
        versionNumber: createdVersion.version,
        action: PublishAction.PUBLISH,
        reason: dto.changelog,
        operatorId: userId,
      });

      await this.publishChannelService.ensureDefaultAgentChannels(tx, {
        id: agentId,
        workspaceId: agent.workspaceId,
      });

      return createdVersion;
    });

    return {
      versionId: result.id,
      version: result.version,
      publishedAt: formatShanghaiDateTime(
        result.publishedAt ?? result.createdAt,
      ),
    };
  }

  async listAgentVersions(
    userId: string,
    agentId: string,
  ): Promise<AgentVersionListItem[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);

    const versions = await this.prisma.agentVersion.findMany({
      where: { agentId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { version: 'desc' },
    });

    return versions.map((version) => ({
      id: version.id,
      version: version.version,
      changelog: version.changelog,
      isCurrent: version.id === agent.currentVersionId,
      publishedAt: version.publishedAt
        ? formatShanghaiDateTime(version.publishedAt)
        : null,
      createdAt: formatShanghaiDateTime(version.createdAt),
      createdBy: {
        id: version.creator.id,
        username: version.creator.username,
      },
    }));
  }

  async listAgentRecords(
    userId: string,
    agentId: string,
  ): Promise<PublishRecordListItem[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureMember(userId, agent.workspaceId);

    return this.publishRecordService.listAgentRecords(agentId);
  }

  async rollbackAgent(
    userId: string,
    agentId: string,
    dto: RollbackAgentDto,
  ): Promise<RollbackAgentResponse> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    const version = await this.prisma.agentVersion.findFirst({
      where: {
        id: dto.versionId,
        agentId,
      },
    });

    if (!version) {
      throw new BusinessException(
        'Agent 发布版本不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const rolledBackAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id: agentId },
        data: {
          currentVersionId: version.id,
          status: AgentStatus.ACTIVE,
        },
      });
      await this.publishRecordService.createAgentRecord(tx, {
        workspaceId: agent.workspaceId,
        agentId,
        versionId: version.id,
        versionNumber: version.version,
        action: PublishAction.ROLLBACK,
        reason: dto.reason,
        operatorId: userId,
        createdAt: rolledBackAt,
      });
    });

    return {
      currentVersionId: version.id,
      version: version.version,
      rolledBackAt: formatShanghaiDateTime(rolledBackAt),
    };
  }

  async offlineAgent(
    userId: string,
    agentId: string,
    dto: OfflineAgentDto,
  ): Promise<OfflineAgentResponse> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    if (!agent.currentVersionId) {
      throw new BusinessException(
        'Agent 尚未发布，无法下线',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const offlineAt = new Date();
    let offlineVersion: number | null = null;
    await this.prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id: agentId },
        data: {
          status: AgentStatus.DRAFT,
        },
      });
      await tx.publishChannel.updateMany({
        where: {
          targetType: PublishTargetType.AGENT,
          targetId: agentId,
        },
        data: {
          enabled: false,
        },
      });
      const currentVersion = agent.currentVersionId
        ? await tx.agentVersion.findUnique({
            where: { id: agent.currentVersionId },
            select: { version: true },
          })
        : null;
      offlineVersion = currentVersion?.version ?? null;
      await this.publishRecordService.createAgentRecord(tx, {
        workspaceId: agent.workspaceId,
        agentId,
        versionId: agent.currentVersionId,
        versionNumber: currentVersion?.version,
        action: PublishAction.OFFLINE,
        reason: dto.reason,
        operatorId: userId,
        createdAt: offlineAt,
      });
    });

    return {
      versionId: agent.currentVersionId,
      version: offlineVersion,
      offlineAt: formatShanghaiDateTime(offlineAt),
    };
  }

  private async findAgentOrThrow(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new BusinessException(
        'Agent 不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return agent;
  }

  private async findAgentForPublishOrThrow(
    agentId: string,
  ): Promise<PublishAgent> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        workflows: {
          include: {
            workflow: true,
            workflowVersion: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        pluginBindings: {
          include: {
            plugin: {
              include: {
                tools: {
                  where: {
                    status: 'ACTIVE',
                  },
                  orderBy: {
                    createdAt: 'asc',
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        knowledgeBaseBindings: {
          include: {
            knowledgeBase: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!agent) {
      throw new BusinessException(
        'Agent 不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return agent;
  }

  private assertAgentCanPublish(agent: PublishAgent): void {
    const check = this.buildPublishCheckItems(agent);
    const failedItems = check.filter((item) => !item.passed);

    if (failedItems.length) {
      throw new BusinessException(
        `Agent 发布检查未通过：${failedItems
          .map((item) => item.message ?? item.label)
          .join('；')}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private buildPublishCheckItems(agent: PublishAgent): PublishCheckItem[] {
    const activeWorkflowBindings = agent.workflows.filter(
      (binding) => binding.enabled,
    );
    const invalidWorkflowBindings = activeWorkflowBindings.filter(
      (binding) => !binding.workflowVersion.isPublished,
    );
    const activePluginBindings = agent.pluginBindings.filter(
      (binding) => binding.status === AgentPluginBindingStatus.ACTIVE,
    );
    const invalidPluginBindings = activePluginBindings.filter(
      (binding) =>
        binding.plugin.status !== PluginStatus.ACTIVE ||
        binding.plugin.invocationEnabled !== true,
    );
    const activeKnowledgeBindings = agent.knowledgeBaseBindings.filter(
      (binding) => binding.enabled,
    );
    const invalidKnowledgeBindings = activeKnowledgeBindings.filter(
      (binding) => binding.knowledgeBase.status !== KnowledgeBaseStatus.ACTIVE,
    );

    return [
      {
        key: 'name',
        label: 'Agent 名称',
        passed: agent.name.trim().length > 0,
        message:
          agent.name.trim().length > 0
            ? 'Agent 名称已配置'
            : 'Agent 名称不能为空',
      },
      {
        key: 'systemPrompt',
        label: '系统提示词',
        passed: agent.systemPrompt.trim().length > 0,
        message:
          agent.systemPrompt.trim().length > 0
            ? '系统提示词已配置'
            : '系统提示词不能为空',
      },
      {
        key: 'model',
        label: '模型配置',
        // 支持新旧两种模型配置：新模型引用或旧 model 字符串任意存在即可发布。
        passed:
          Boolean(agent.workspaceModelId) || agent.model.trim().length > 0,
        message:
          Boolean(agent.workspaceModelId) || agent.model.trim().length > 0
            ? '模型已配置'
            : '模型配置不能为空',
      },
      {
        key: 'temperature',
        label: '模型温度',
        passed: agent.temperature >= 0 && agent.temperature <= 2,
        message:
          agent.temperature >= 0 && agent.temperature <= 2
            ? '模型温度配置有效'
            : '模型温度需在 0 到 2 之间',
      },
      {
        key: 'workflows',
        label: '工作流绑定',
        passed: invalidWorkflowBindings.length === 0,
        message:
          invalidWorkflowBindings.length === 0
            ? '工作流绑定有效'
            : `存在未发布的工作流版本：${invalidWorkflowBindings
                .map((binding) => binding.workflow.name)
                .join('、')}`,
      },
      {
        key: 'knowledges',
        label: '知识库绑定',
        passed: invalidKnowledgeBindings.length === 0,
        message:
          invalidKnowledgeBindings.length === 0
            ? '知识库绑定有效'
            : `存在不可用的知识库：${invalidKnowledgeBindings
                .map((binding) => binding.knowledgeBase.name)
                .join('、')}`,
      },
      {
        key: 'plugins',
        label: '插件绑定',
        passed: invalidPluginBindings.length === 0,
        message:
          invalidPluginBindings.length === 0
            ? '插件绑定有效'
            : `存在不可调用的插件：${invalidPluginBindings
                .map((binding) => binding.plugin.name)
                .join('、')}`,
      },
    ];
  }

  private buildAgentSnapshot(agent: PublishAgent): AgentPublishSnapshot {
    // 发布快照同时保存 workspaceModelId 和 model，确保新链路优先且旧链路可兜底。
    return {
      agent: {
        id: agent.id,
        workspaceId: agent.workspaceId,
        name: agent.name,
        description: agent.description,
        avatarUrl: agent.avatarUrl,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        workspaceModelId: agent.workspaceModelId,
        temperature: agent.temperature,
        openingMessage: agent.openingMessage,
        contextLimit: agent.contextLimit,
      },
      workflows: agent.workflows.map((binding) => ({
        bindingId: binding.id,
        workflowId: binding.workflowId,
        workflowVersionId: binding.workflowVersionId,
        workflowName: binding.workflow.name,
        enabled: binding.enabled,
        tool: this.buildWorkflowToolSnapshot(binding),
      })),
      knowledges: agent.knowledgeBaseBindings.map((binding) => ({
        bindingId: binding.id,
        knowledgeBaseId: binding.knowledgeBaseId,
        enabled: binding.enabled,
        config: this.toKnowledgeBindingConfig(binding.config),
      })),
      plugins: agent.pluginBindings.map((binding) => ({
        bindingId: binding.id,
        pluginId: binding.pluginId,
        pluginCode: binding.plugin.code,
        status: binding.status,
        autoInvoke: binding.autoInvoke,
        sortOrder: binding.sortOrder,
        config: binding.config,
        tools: this.buildPluginToolSnapshot(binding),
      })),
      channels: [
        {
          channel: PublishChannelType.WEB,
          enabled: true,
          config: null,
        },
        {
          channel: PublishChannelType.API,
          enabled: false,
          config: null,
        },
      ],
    };
  }

  private toInputJsonValue(value: AgentPublishSnapshot): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  }

  private buildPluginToolSnapshot(
    binding: PublishAgent['pluginBindings'][number],
  ): ToolDefinition[] {
    if (
      binding.status !== AgentPluginBindingStatus.ACTIVE ||
      binding.plugin.status !== PluginStatus.ACTIVE ||
      !binding.plugin.invocationEnabled
    ) {
      return [];
    }

    const disabledTools = this.getDisabledTools(binding.config);

    return binding.plugin.tools
      .filter((tool) => !disabledTools.includes(tool.code))
      .map((tool) => ({
        type: 'function',
        function: {
          name: `${binding.plugin.code}__${tool.code}`,
          description: tool.description,
          parameters: (tool.inputSchema ?? {}) as Record<string, unknown>,
        },
      }));
  }

  private getDisabledTools(config: Prisma.JsonValue): string[] {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return [];
    }

    const disabledTools = config.disabledTools;
    return Array.isArray(disabledTools)
      ? disabledTools.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private buildWorkflowToolSnapshot(
    binding: PublishAgent['workflows'][number],
  ): ToolDefinition | null {
    if (!binding.enabled || !binding.workflowVersion.isPublished) {
      return null;
    }

    return buildWorkflowToolDefinition({
      workflowVersionId: binding.workflowVersionId,
      workflowName: binding.workflow.name,
      workflowDescription: binding.workflow.description,
      inputSchema: this.toObjectOrNull(binding.workflowVersion.inputSchema),
    });
  }

  private toObjectOrNull(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value;
  }

  private toKnowledgeBindingConfig(
    value: Prisma.JsonValue | null,
  ): RuntimeKnowledgeBindingConfig | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value;
  }
}
