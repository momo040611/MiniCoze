import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AgentPluginBindingStatus,
  AgentStatus,
  PluginStatus,
  Prisma,
  PublishAction,
  PublishActionStatus,
  PublishChannelType,
  PublishTargetType,
} from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { OfflineAgentDto } from './dto/offline-agent.dto';
import { PublishAgentDto } from './dto/publish-agent.dto';
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
        plugin: true;
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

      await tx.publishRecord.create({
        data: {
          workspaceId: agent.workspaceId,
          targetType: PublishTargetType.AGENT,
          targetId: agentId,
          versionId: createdVersion.id,
          action: PublishAction.PUBLISH,
          status: PublishActionStatus.SUCCESS,
          changelog: dto.changelog,
          operatorId: userId,
        },
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

    const records = await this.prisma.publishRecord.findMany({
      where: {
        targetType: PublishTargetType.AGENT,
        targetId: agentId,
      },
      include: {
        operator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => ({
      id: record.id,
      action: record.action,
      status: record.status,
      versionId: record.versionId,
      changelog: record.changelog,
      errorMessage: record.errorMessage,
      createdAt: formatShanghaiDateTime(record.createdAt),
      operator: {
        id: record.operator.id,
        username: record.operator.username,
      },
    }));
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
    await this.prisma.$transaction([
      this.prisma.agent.update({
        where: { id: agentId },
        data: {
          currentVersionId: version.id,
          status: AgentStatus.ACTIVE,
        },
      }),
      this.prisma.publishRecord.create({
        data: {
          workspaceId: agent.workspaceId,
          targetType: PublishTargetType.AGENT,
          targetId: agentId,
          versionId: version.id,
          action: PublishAction.ROLLBACK,
          status: PublishActionStatus.SUCCESS,
          changelog: dto.reason,
          operatorId: userId,
          createdAt: rolledBackAt,
        },
      }),
    ]);

    return {
      currentVersionId: version.id,
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
      await tx.publishRecord.create({
        data: {
          workspaceId: agent.workspaceId,
          targetType: PublishTargetType.AGENT,
          targetId: agentId,
          versionId: agent.currentVersionId,
          action: PublishAction.OFFLINE,
          status: PublishActionStatus.SUCCESS,
          changelog: dto.reason,
          operatorId: userId,
          createdAt: offlineAt,
        },
      });
    });

    return {
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
            plugin: true,
          },
          orderBy: { sortOrder: 'asc' },
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
        passed: agent.model.trim().length > 0,
        message:
          agent.model.trim().length > 0 ? '模型已配置' : '模型配置不能为空',
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
    return {
      agent: {
        id: agent.id,
        workspaceId: agent.workspaceId,
        name: agent.name,
        description: agent.description,
        avatarUrl: agent.avatarUrl,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
        temperature: agent.temperature,
        openingMessage: agent.openingMessage,
        contextLimit: agent.contextLimit,
      },
      workflows: agent.workflows.map((binding) => ({
        bindingId: binding.id,
        workflowId: binding.workflowId,
        workflowVersionId: binding.workflowVersionId,
        enabled: binding.enabled,
      })),
      plugins: agent.pluginBindings.map((binding) => ({
        bindingId: binding.id,
        pluginId: binding.pluginId,
        pluginCode: binding.plugin.code,
        status: binding.status,
        autoInvoke: binding.autoInvoke,
        sortOrder: binding.sortOrder,
        config: binding.config,
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
}
