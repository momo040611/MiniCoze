import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AgentStatus,
  FilePurpose,
  Prisma,
  PublishChannel,
  PublishChannelType,
  PublishTargetType,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ChannelAccessGuard, type ChannelAccessConfig } from '../../common/utils/channel-access.guard';
import { PrismaService } from '../../database/prisma.service';
import type { RuntimeEvent } from '../../shared/types/agent';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { FileService } from '../file/file.service';
import type { FileResponse } from '../file/types/file-response.type';
import type { UploadedFile } from '../file/types/uploaded-file.type';
import { parseAgentPublishSnapshot } from '../publish/agent-publish-snapshot.util';
import type { AgentPublishSnapshot } from '../publish/types/publish.types';
import { PublicAgentChatDto } from './dto/public-agent-chat.dto';

export interface PublicAgentInfo {
  name: string;
  description: string | null;
  avatarUrl: string | null;
  openingMessage: string | null;
}

interface PublishedAgentRunTarget {
  creatorId: string;
  channelId: string;
  apiKeyHash?: string;
  // 渠道访问配置（限流/白名单/Origin），进入运行入口前由 ChannelAccessGuard 校验。
  channelConfig: Record<string, unknown>;
  snapshot: AgentPublishSnapshot;
}

@Injectable()
export class PublicAgentService {
  private readonly publicChatTextMimeTypes = new Set([
    'text/plain',
    'text/markdown',
    'text/x-markdown',
  ]);

  private readonly publicChatTextExtensions = new Set(['.txt', '.md']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRuntimeService: AgentRuntimeService,
    private readonly fileService: FileService,
  ) {}

  async getPublicAgentBySlug(slug: string): Promise<PublicAgentInfo> {
    const target = await this.findPublicAgentTargetBySlug(slug);

    return {
      name: target.snapshot.agent.name,
      description: target.snapshot.agent.description,
      avatarUrl: target.snapshot.agent.avatarUrl,
      openingMessage: target.snapshot.agent.openingMessage,
    };
  }

  async createWebChatStream(
    slug: string,
    dto: PublicAgentChatDto,
    access?: { ip?: string; origin?: string },
  ): Promise<AsyncIterable<RuntimeEvent>> {
    const target = await this.findPublicAgentTargetBySlug(slug);
    ChannelAccessGuard.enforce(
      target.channelConfig as ChannelAccessConfig,
      { channelId: target.channelId, ip: access?.ip, origin: access?.origin },
    );

    return this.runPublishedTarget(target, dto);
  }

  async uploadWebChatAttachment(
    slug: string,
    file: UploadedFile | undefined,
    access?: { ip?: string; origin?: string },
  ): Promise<FileResponse> {
    const target = await this.findPublicAgentTargetBySlug(slug);
    ChannelAccessGuard.enforce(
      target.channelConfig as ChannelAccessConfig,
      { channelId: target.channelId, ip: access?.ip, origin: access?.origin },
    );

    this.ensureSupportedPublicChatAttachment(file);

    return this.fileService.upload(target.creatorId, file, {
      purpose: FilePurpose.CHAT_ATTACHMENT,
      workspaceId: target.snapshot.agent.workspaceId,
    });
  }

  async createApiRunStream(
    authorization: string | undefined,
    dto: PublicAgentChatDto,
    access?: { ip?: string; origin?: string },
  ): Promise<AsyncIterable<RuntimeEvent>> {
    const target = await this.findPublicAgentTargetByApiKey(authorization);
    ChannelAccessGuard.enforce(
      target.channelConfig as ChannelAccessConfig,
      { channelId: target.channelId, ip: access?.ip, origin: access?.origin },
    );

    return this.runPublishedTarget(target, dto, 'API');
  }

  private runPublishedTarget(
    target: PublishedAgentRunTarget,
    dto: PublicAgentChatDto,
    source?: 'PUBLIC' | 'API',
  ): AsyncIterable<RuntimeEvent> {
    return this.agentRuntimeService.runPublishedSnapshot({
      agentId: target.snapshot.agent.id,
      userId: target.creatorId,
      message: this.resolveMessage(dto),
      conversationId: dto.conversationId,
      attachments: dto.attachments,
      publicAccess: {
        conversationIdPrefix: this.getPublicConversationIdPrefix(target, dto),
      },
      source,
      snapshot: target.snapshot,
    });
  }

  private async findPublicAgentTargetBySlug(
    slug: string,
  ): Promise<PublishedAgentRunTarget> {
    const channel = await this.prisma.publishChannel.findFirst({
      where: {
        targetType: PublishTargetType.AGENT,
        channel: PublishChannelType.WEB,
        enabled: true,
        config: {
          path: ['slug'],
          equals: slug,
        },
      },
    });

    if (!channel) {
      throw new BusinessException(
        'Public agent does not exist or is disabled',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return this.findPublishedAgentTarget(channel);
  }

  private async findPublicAgentTargetByApiKey(
    authorization: string | undefined,
  ): Promise<PublishedAgentRunTarget> {
    const apiKey = this.parseBearerKey(authorization);
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    const channel = await this.prisma.publishChannel.findFirst({
      where: {
        targetType: PublishTargetType.AGENT,
        channel: PublishChannelType.API,
        enabled: true,
        config: {
          path: ['apiKeyHash'],
          equals: apiKeyHash,
        },
      },
    });

    if (!channel) {
      throw new BusinessException(
        'Invalid API key or disabled API channel',
        ErrorCode.Unauthorized,
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.assertApiChannelNotExpired(channel);

    return this.findPublishedAgentTarget(channel, apiKeyHash);
  }

  private async findPublishedAgentTarget(
    channel: PublishChannel,
    apiKeyHash?: string,
  ): Promise<PublishedAgentRunTarget> {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: channel.targetId,
        status: AgentStatus.ACTIVE,
        currentVersionId: { not: null },
      },
      include: {
        currentVersion: true,
      },
    });

    if (!agent?.currentVersion) {
      throw new BusinessException(
        'Public agent does not exist or is disabled',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const snapshot = parseAgentPublishSnapshot(agent.currentVersion.snapshot);
    if (!snapshot) {
      throw new BusinessException(
        'Agent publish snapshot is invalid',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      creatorId: agent.creatorId,
      channelId: channel.id,
      apiKeyHash,
      channelConfig: this.isJsonObject(channel.config)
        ? (channel.config as Record<string, unknown>)
        : {},
      snapshot,
    };
  }

  private getPublicConversationIdPrefix(
    target: PublishedAgentRunTarget,
    dto: PublicAgentChatDto,
  ): string {
    const visitorKey = target.apiKeyHash
      ? `api:${target.channelId}:${target.apiKeyHash}`
      : `web:${target.channelId}:${this.resolveWebVisitorId(dto)}`;
    const visitorHash = createHash('sha256').update(visitorKey).digest('hex');

    return `public:${target.snapshot.agent.id}:${visitorHash}:`;
  }

  private resolveWebVisitorId(dto: PublicAgentChatDto): string {
    const visitorId = dto.visitorId?.trim();
    if (visitorId) {
      return visitorId;
    }

    if (dto.conversationId) {
      throw new BusinessException(
        'visitorId is required when continuing a public conversation',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return randomUUID();
  }

  private resolveMessage(dto: PublicAgentChatDto): string {
    if (dto.message?.trim()) {
      return dto.message.trim();
    }

    if (dto.inputs && Object.keys(dto.inputs).length > 0) {
      return JSON.stringify(dto.inputs);
    }

    throw new BusinessException(
      'message or inputs is required',
      ErrorCode.BadRequest,
      HttpStatus.BAD_REQUEST,
    );
  }

  private ensureSupportedPublicChatAttachment(
    file: UploadedFile | undefined,
  ): void {
    if (!file) {
      return;
    }

    const isImage = file.mimetype.startsWith('image/');
    const extension = this.getFileExtension(file.originalname);
    const isText =
      this.publicChatTextMimeTypes.has(file.mimetype) ||
      (extension ? this.publicChatTextExtensions.has(extension) : false);

    if (isImage || isText) {
      return;
    }

    throw new BusinessException(
      'Public chat attachments only support images and txt/md text files',
      ErrorCode.BadRequest,
      HttpStatus.BAD_REQUEST,
    );
  }

  private getFileExtension(fileName: string): string | null {
    const index = fileName.lastIndexOf('.');
    return index >= 0 ? fileName.slice(index).toLowerCase() : null;
  }

  private parseBearerKey(authorization: string | undefined): string {
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const apiKey = match?.[1]?.trim();

    if (!apiKey) {
      throw new BusinessException(
        'Bearer API key is required',
        ErrorCode.Unauthorized,
        HttpStatus.UNAUTHORIZED,
      );
    }

    return apiKey;
  }

  private assertApiChannelNotExpired(channel: PublishChannel): void {
    const config = this.isJsonObject(channel.config) ? channel.config : {};
    const expiresAt = this.getNullableString(config.expiresAt);

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      throw new BusinessException(
        'API key has expired',
        ErrorCode.Unauthorized,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private isJsonObject(value: unknown): value is Prisma.JsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private getNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
