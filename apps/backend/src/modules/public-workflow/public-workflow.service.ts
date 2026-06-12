import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  PublishChannel,
  PublishChannelType,
  PublishTargetType,
  WorkflowStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import type { WorkflowStreamEvent } from '../workflow/internal/execute/workflow-run-event';
import { WorkflowRunService } from '../workflow/workflow-run.service';
import { PublicWorkflowRunDto } from './dto/public-workflow-run.dto';

@Injectable()
export class PublicWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowRunService: WorkflowRunService,
  ) {}

  async run(
    authorization: string | undefined,
    dto: PublicWorkflowRunDto,
    onEvent?: (event: WorkflowStreamEvent) => void,
  ) {
    const target = await this.findPublicWorkflowTarget(authorization);

    return this.workflowRunService.runPublishedWorkflow({
      workflowId: target.workflowId,
      workflowVersionId: target.workflowVersionId,
      startedBy: target.creatorId,
      input: dto.input,
      onEvent,
    });
  }

  private async findPublicWorkflowTarget(authorization: string | undefined) {
    const apiKey = this.parseBearerKey(authorization);
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    const channel = await this.prisma.publishChannel.findFirst({
      where: {
        targetType: PublishTargetType.WORKFLOW,
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
        'Invalid API key or disabled workflow API channel',
        ErrorCode.Unauthorized,
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.assertApiChannelNotExpired(channel);

    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: channel.targetId,
        status: WorkflowStatus.ACTIVE,
        currentVersionId: { not: null },
      },
      select: {
        id: true,
        creatorId: true,
        currentVersionId: true,
      },
    });

    if (!workflow?.currentVersionId) {
      throw new BusinessException(
        'Public workflow does not exist or is disabled',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      workflowId: workflow.id,
      workflowVersionId: workflow.currentVersionId,
      creatorId: workflow.creatorId,
    };
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
