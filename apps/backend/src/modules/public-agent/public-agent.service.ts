import { HttpStatus, Injectable } from '@nestjs/common';
import { AgentStatus, Prisma, PublishChannelType } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { parseAgentPublishSnapshot } from '../publish/agent-publish-snapshot.util';
import type { AgentPublishSnapshot } from '../publish/types/publish.types';

export interface PublicAgentInfo {
  name: string;
  description: string | null;
  avatarUrl: string | null;
  openingMessage: string | null;
}

@Injectable()
export class PublicAgentService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicAgentBySlug(slug: string): Promise<PublicAgentInfo> {
    const channel = await this.prisma.publishChannel.findFirst({
      where: {
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
        '公开 Agent 不存在或已关闭',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

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
        '公开 Agent 不存在或已关闭',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const snapshot = agent.currentVersion.snapshot as Prisma.JsonObject;
    const snapshotAgent = this.isJsonObject(snapshot.agent)
      ? snapshot.agent
      : {};

    return {
      name: this.getString(snapshotAgent.name, agent.name),
      description: this.getNullableString(snapshotAgent.description),
      avatarUrl: this.getNullableString(snapshotAgent.avatarUrl),
      openingMessage: this.getNullableString(snapshotAgent.openingMessage),
    };
  }

  async createWebChatStream(slug: string, message?: string): Promise<never> {
    void message;
    const snapshot = await this.findPublicAgentSnapshotBySlug(slug);
    void snapshot;

    throw new BusinessException(
      '公开聊天运行能力尚未接入',
      ErrorCode.BusinessError,
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  createApiRunStream(apiKey: string | undefined): never {
    void apiKey;
    // TODO: 后续根据 Bearer mc_live_xxx 的 sha256 hash 查询 API PublishChannel，
    // 校验渠道启用、Agent ACTIVE、currentVersionId 存在后，再用 AgentVersion.snapshot 运行。
    throw new BusinessException(
      '公开 API 运行能力尚未接入',
      ErrorCode.BusinessError,
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  private isJsonObject(value: unknown): value is Prisma.JsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private async findPublicAgentSnapshotBySlug(
    slug: string,
  ): Promise<AgentPublishSnapshot> {
    const channel = await this.prisma.publishChannel.findFirst({
      where: {
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
        '公开 Agent 不存在或已关闭',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

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
        '公开 Agent 不存在或已关闭',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const snapshot = parseAgentPublishSnapshot(agent.currentVersion.snapshot);
    if (!snapshot) {
      throw new BusinessException(
        'Agent 发布快照无效',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    return snapshot;
  }

  private getString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }

  private getNullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }
}
