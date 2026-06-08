import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PublishAction,
  PublishActionStatus,
  PublishTargetType,
} from '@prisma/client';
import { formatShanghaiDateTime } from '../../common/utils/date-time';
import { PrismaService } from '../../database/prisma.service';
import type { PublishRecordListItem } from './types/publish.types';

@Injectable()
export class PublishRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async createAgentRecord(
    tx: Prisma.TransactionClient | PrismaService,
    input: {
      workspaceId: string;
      agentId: string;
      versionId?: string | null;
      versionNumber?: number | null;
      action: PublishAction;
      operatorId: string;
      reason?: string | null;
      errorMessage?: string | null;
      status?: PublishActionStatus;
      createdAt?: Date;
    },
  ): Promise<void> {
    await tx.publishRecord.create({
      data: {
        workspaceId: input.workspaceId,
        targetType: PublishTargetType.AGENT,
        targetId: input.agentId,
        versionId: input.versionId,
        versionNumber: input.versionNumber,
        action: input.action,
        status: input.status ?? PublishActionStatus.SUCCESS,
        changelog: input.reason,
        errorMessage: input.errorMessage,
        operatorId: input.operatorId,
        createdAt: input.createdAt,
      },
    });
  }

  async listAgentRecords(agentId: string): Promise<PublishRecordListItem[]> {
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

    const missingVersionIds = records
      .filter((record) => record.versionNumber === null && record.versionId)
      .map((record) => record.versionId as string);
    const versions = missingVersionIds.length
      ? await this.prisma.agentVersion.findMany({
          where: { id: { in: missingVersionIds } },
          select: { id: true, version: true },
        })
      : [];
    const versionMap = new Map(
      versions.map((version) => [version.id, version.version]),
    );

    return records.map((record) => {
      const version =
        record.versionNumber ??
        (record.versionId ? (versionMap.get(record.versionId) ?? null) : null);

      return {
        id: record.id,
        action: record.action,
        status: record.status,
        versionId: record.versionId,
        version,
        versionNumber: version,
        reason: record.changelog,
        changelog: record.changelog,
        errorMessage: record.errorMessage,
        operatorId: record.operatorId,
        operatorName: record.operator.username,
        createdAt: formatShanghaiDateTime(record.createdAt),
        operator: {
          id: record.operator.id,
          username: record.operator.username,
        },
      };
    });
  }
}
