import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  PublishAction,
  PublishChannel,
  PublishChannelType,
  PublishTargetType,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { RotateApiKeyDto } from './dto/rotate-api-key.dto';
import { UpdatePublishChannelDto } from './dto/update-publish-channel.dto';
import { PublishRecordService } from './publish-record.service';
import {
  ApiPublishChannelConfig,
  PublishChannelConfig,
  PublishChannelResponse,
  RotateApiKeyResponse,
  WebPublishChannelConfig,
} from './types/publish-channel.types';

@Injectable()
export class PublishChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly publishRecordService: PublishRecordService,
  ) {}

  async listAgentChannels(
    userId: string,
    agentId: string,
  ): Promise<PublishChannelResponse[]> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    const channels = await this.prisma.publishChannel.findMany({
      where: {
        targetType: PublishTargetType.AGENT,
        targetId: agentId,
      },
      orderBy: { channel: 'asc' },
    });

    return channels.map((channel) => this.toChannelResponse(channel));
  }

  async ensureDefaultAgentChannels(
    tx: Prisma.TransactionClient,
    agent: { id: string; workspaceId: string },
  ): Promise<void> {
    const existingChannels = await tx.publishChannel.findMany({
      where: {
        targetType: PublishTargetType.AGENT,
        targetId: agent.id,
      },
      select: { channel: true },
    });
    const existingChannelSet = new Set(
      existingChannels.map((item) => item.channel),
    );

    if (!existingChannelSet.has(PublishChannelType.WEB)) {
      await tx.publishChannel.create({
        data: {
          workspaceId: agent.workspaceId,
          targetType: PublishTargetType.AGENT,
          targetId: agent.id,
          channel: PublishChannelType.WEB,
          enabled: true,
          config: this.toInputJsonValue(this.createDefaultWebConfig()),
        },
      });
    } else {
      await tx.publishChannel.updateMany({
        where: {
          targetType: PublishTargetType.AGENT,
          targetId: agent.id,
          channel: PublishChannelType.WEB,
        },
        data: {
          enabled: true,
        },
      });
    }

    if (!existingChannelSet.has(PublishChannelType.API)) {
      await tx.publishChannel.create({
        data: {
          workspaceId: agent.workspaceId,
          targetType: PublishTargetType.AGENT,
          targetId: agent.id,
          channel: PublishChannelType.API,
          enabled: false,
          config: this.toInputJsonValue(this.createDefaultApiConfig()),
        },
      });
    }
  }

  async updateAgentChannel(
    userId: string,
    agentId: string,
    channel: PublishChannelType,
    dto: UpdatePublishChannelDto,
  ): Promise<PublishChannelResponse> {
    const agent = await this.findManageablePublishedAgentOrThrow(
      userId,
      agentId,
    );
    const existingChannel = await this.findOrCreateDefaultChannel(
      this.prisma,
      agent,
      channel,
    );
    const nextConfig = this.mergeChannelConfig(channel, existingChannel, dto);
    const updatedChannel = await this.prisma.publishChannel.update({
      where: { id: existingChannel.id },
      data: {
        config: this.toInputJsonValue(nextConfig),
      },
    });

    await this.createRecord({
      workspaceId: agent.workspaceId,
      targetId: agentId,
      versionId: agent.currentVersionId,
      versionNumber: agent.currentVersion?.version,
      operatorId: userId,
      action: PublishAction.UPDATE_CHANNEL,
      changelog: `更新 ${channel} 发布渠道配置`,
    });

    return this.toChannelResponse(updatedChannel);
  }

  async enableAgentChannel(
    userId: string,
    agentId: string,
    channel: PublishChannelType,
  ): Promise<PublishChannelResponse> {
    const agent = await this.findManageablePublishedAgentOrThrow(
      userId,
      agentId,
    );
    const existingChannel = await this.findOrCreateDefaultChannel(
      this.prisma,
      agent,
      channel,
    );
    const updatedChannel = await this.prisma.publishChannel.update({
      where: { id: existingChannel.id },
      data: { enabled: true },
    });

    await this.createRecord({
      workspaceId: agent.workspaceId,
      targetId: agentId,
      versionId: agent.currentVersionId,
      versionNumber: agent.currentVersion?.version,
      operatorId: userId,
      action: PublishAction.ENABLE_CHANNEL,
      changelog: `启用 ${channel} 发布渠道`,
    });

    return this.toChannelResponse(updatedChannel);
  }

  async disableAgentChannel(
    userId: string,
    agentId: string,
    channel: PublishChannelType,
  ): Promise<PublishChannelResponse> {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    const existingChannel = await this.prisma.publishChannel.findUnique({
      where: {
        targetType_targetId_channel: {
          targetType: PublishTargetType.AGENT,
          targetId: agentId,
          channel,
        },
      },
    });

    if (!existingChannel) {
      throw new BusinessException(
        '发布渠道不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const updatedChannel = await this.prisma.publishChannel.update({
      where: { id: existingChannel.id },
      data: { enabled: false },
    });

    await this.createRecord({
      workspaceId: agent.workspaceId,
      targetId: agentId,
      versionId: agent.currentVersionId,
      versionNumber: agent.currentVersion?.version,
      operatorId: userId,
      action: PublishAction.DISABLE_CHANNEL,
      changelog: `禁用 ${channel} 发布渠道`,
    });

    return this.toChannelResponse(updatedChannel);
  }

  async rotateApiKey(
    userId: string,
    agentId: string,
    dto?: RotateApiKeyDto,
  ): Promise<RotateApiKeyResponse> {
    const agent = await this.findManageablePublishedAgentOrThrow(
      userId,
      agentId,
    );
    const existingChannel = await this.findOrCreateDefaultChannel(
      this.prisma,
      agent,
      PublishChannelType.API,
    );
    const rawKey = `mc_live_${randomBytes(24).toString('base64url')}`;
    const apiKeyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKeyPrefix = rawKey.slice(0, 16);
    const currentConfig = this.normalizeApiConfig(existingChannel.config);
    const rotatedAt = new Date();

    await this.prisma.publishChannel.update({
      where: { id: existingChannel.id },
      data: {
        config: this.toInputJsonValue({
          ...currentConfig,
          apiKeyHash,
          apiKeyPrefix,
        }),
      },
    });

    await this.createRecord({
      workspaceId: agent.workspaceId,
      targetId: agentId,
      versionId: agent.currentVersionId,
      versionNumber: agent.currentVersion?.version,
      operatorId: userId,
      action: PublishAction.ROTATE_API_KEY,
      changelog: dto?.reason ?? '重新生成 API Key',
      createdAt: rotatedAt,
    });

    return {
      apiKey: rawKey,
      apiKeyPrefix,
      rotatedAt: formatShanghaiDateTime(rotatedAt),
    };
  }

  private async findManageablePublishedAgentOrThrow(
    userId: string,
    agentId: string,
  ) {
    const agent = await this.findAgentOrThrow(agentId);
    await this.workspaceAccessService.ensureCanManage(
      userId,
      agent.workspaceId,
    );

    if (!agent.currentVersionId) {
      throw new BusinessException(
        'Agent 尚未发布，无法操作发布渠道',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return agent;
  }

  private async findAgentOrThrow(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        workspaceId: true,
        currentVersionId: true,
        currentVersion: {
          select: {
            version: true,
          },
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

  private async findOrCreateDefaultChannel(
    tx: Prisma.TransactionClient | PrismaService,
    agent: { id: string; workspaceId: string },
    channel: PublishChannelType,
  ): Promise<PublishChannel> {
    const existingChannel = await tx.publishChannel.findUnique({
      where: {
        targetType_targetId_channel: {
          targetType: PublishTargetType.AGENT,
          targetId: agent.id,
          channel,
        },
      },
    });

    if (existingChannel) {
      return existingChannel;
    }

    return tx.publishChannel.create({
      data: {
        workspaceId: agent.workspaceId,
        targetType: PublishTargetType.AGENT,
        targetId: agent.id,
        channel,
        enabled: channel === PublishChannelType.WEB,
        config: this.toInputJsonValue(this.createDefaultConfig(channel)),
      },
    });
  }

  private mergeChannelConfig(
    channel: PublishChannelType,
    existingChannel: PublishChannel,
    dto: UpdatePublishChannelDto,
  ): PublishChannelConfig {
    if (channel === PublishChannelType.WEB) {
      return {
        ...this.normalizeWebConfig(existingChannel.config),
        ...this.pickDefined({
          allowAnonymous: dto.allowAnonymous,
          theme: dto.theme,
          showBranding: dto.showBranding,
          allowedOrigins: dto.allowedOrigins,
        }),
      };
    }

    return {
      ...this.normalizeApiConfig(existingChannel.config),
      ...this.pickDefined({
        rateLimitPerMinute: dto.rateLimitPerMinute,
        rateLimitPerDay: dto.rateLimitPerDay,
        allowedOrigins: dto.allowedOrigins,
        allowedIps: dto.allowedIps,
        expiresAt: dto.expiresAt,
      }),
    };
  }

  private createDefaultConfig(
    channel: PublishChannelType,
  ): PublishChannelConfig {
    return channel === PublishChannelType.WEB
      ? this.createDefaultWebConfig()
      : this.createDefaultApiConfig();
  }

  private createDefaultWebConfig(): WebPublishChannelConfig {
    const slug = `pub_${randomBytes(8).toString('hex')}`;

    return {
      slug,
      publicPath: `/share/agents/${slug}`,
      embedPath: `/embed/agents/${slug}`,
      allowAnonymous: true,
      theme: 'light',
      showBranding: true,
      allowedOrigins: ['*'],
    };
  }

  private createDefaultApiConfig(): ApiPublishChannelConfig {
    return {
      apiKeyHash: null,
      apiKeyPrefix: null,
      rateLimitPerMinute: 60,
      rateLimitPerDay: 1000,
      allowedOrigins: [],
      allowedIps: [],
      expiresAt: null,
    };
  }

  private normalizeWebConfig(
    config: Prisma.JsonValue,
  ): WebPublishChannelConfig {
    const defaultConfig = this.createDefaultWebConfig();
    const jsonConfig = this.isJsonObject(config) ? config : {};

    return {
      slug: this.getString(jsonConfig.slug, defaultConfig.slug),
      publicPath: this.getString(
        jsonConfig.publicPath,
        defaultConfig.publicPath,
      ),
      embedPath: this.getString(jsonConfig.embedPath, defaultConfig.embedPath),
      allowAnonymous: this.getBoolean(jsonConfig.allowAnonymous, true),
      theme: this.getString(jsonConfig.theme, 'light'),
      showBranding: this.getBoolean(jsonConfig.showBranding, true),
      allowedOrigins: this.getStringArray(jsonConfig.allowedOrigins, ['*']),
    };
  }

  private normalizeApiConfig(
    config: Prisma.JsonValue,
  ): ApiPublishChannelConfig {
    const jsonConfig = this.isJsonObject(config) ? config : {};

    return {
      apiKeyHash: this.getNullableString(jsonConfig.apiKeyHash),
      apiKeyPrefix: this.getNullableString(jsonConfig.apiKeyPrefix),
      rateLimitPerMinute: this.getNumber(jsonConfig.rateLimitPerMinute, 60),
      rateLimitPerDay: this.getNumber(jsonConfig.rateLimitPerDay, 1000),
      allowedOrigins: this.getStringArray(jsonConfig.allowedOrigins, []),
      allowedIps: this.getStringArray(jsonConfig.allowedIps, []),
      expiresAt: this.getNullableString(jsonConfig.expiresAt),
    };
  }

  private toChannelResponse(channel: PublishChannel): PublishChannelResponse {
    return {
      id: channel.id,
      channel: channel.channel,
      enabled: channel.enabled,
      config:
        channel.channel === PublishChannelType.WEB
          ? this.normalizeWebConfig(channel.config)
          : this.normalizeApiConfig(channel.config),
      createdAt: formatShanghaiDateTime(channel.createdAt),
      updatedAt: formatShanghaiDateTime(channel.updatedAt),
    };
  }

  private async createRecord(input: {
    workspaceId: string;
    targetId: string;
    versionId: string | null;
    versionNumber?: number | null;
    operatorId: string;
    action: PublishAction;
    changelog: string;
    createdAt?: Date;
  }): Promise<void> {
    await this.publishRecordService.createAgentRecord(this.prisma, {
      workspaceId: input.workspaceId,
      agentId: input.targetId,
      versionId: input.versionId,
      versionNumber: input.versionNumber,
      action: input.action,
      reason: input.changelog,
      operatorId: input.operatorId,
      createdAt: input.createdAt,
    });
  }

  private pickDefined<T extends Record<string, unknown>>(input: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }

  private isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private getString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }

  private getNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private getBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private getNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : fallback;
  }

  private getStringArray(value: unknown, fallback: string[]): string[] {
    return Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
      ? value
      : fallback;
  }

  private toInputJsonValue(value: PublishChannelConfig): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  }
}
