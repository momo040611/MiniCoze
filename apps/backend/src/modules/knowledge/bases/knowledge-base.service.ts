import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { KnowledgeBaseStatus, type KnowledgeBase } from '@prisma/client';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { formatShanghaiDateTime } from '../../../common/utils/date-time';
import { PrismaService } from '../../../database/prisma.service';
import { WorkspaceAccessService } from '../../workspace/workspace-access.service';
import { EMBEDDER_TOKEN, type Embedder } from '../embedding/embedder.interface';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { KnowledgeBaseResponseDto } from './dto/knowledge-base-response.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(EMBEDDER_TOKEN) private readonly embedder: Embedder,
  ) {}

  async create(
    userId: string,
    dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseResponseDto> {
    await this.workspaceAccess.ensureMember(userId, dto.workspaceId);

    const kb = await this.prisma.knowledgeBase.create({
      data: {
        workspaceId: dto.workspaceId,
        creatorId: userId,
        name: dto.name,
        description: dto.description ?? null,
      },
    });

    return this.toResponse(kb);
  }

  async findByWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<KnowledgeBaseResponseDto[]> {
    await this.workspaceAccess.ensureMember(userId, workspaceId);

    const list = await this.prisma.knowledgeBase.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
    return list.map((kb) => this.toResponse(kb));
  }

  async remove(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<KnowledgeBaseResponseDto> {
    const kb = await this.findByIdOrThrow(knowledgeBaseId);
    await this.workspaceAccess.ensureCanManage(userId, kb.workspaceId);

    const removed = await this.prisma.knowledgeBase.delete({
      where: { id: knowledgeBaseId },
    });
    return this.toResponse(removed);
  }

  async toggleEnabled(
    userId: string,
    knowledgeBaseId: string,
    enabled: boolean,
  ): Promise<KnowledgeBaseResponseDto> {
    const kb = await this.findByIdOrThrow(knowledgeBaseId);
    await this.workspaceAccess.ensureCanManage(userId, kb.workspaceId);

    if (kb.status === KnowledgeBaseStatus.ARCHIVED) {
      throw new BusinessException(
        '归档的知识库无法切换状态',
        ErrorCode.KnowledgeBaseInvalidStatus,
        HttpStatus.BAD_REQUEST,
      );
    }

    const nextStatus = enabled
      ? KnowledgeBaseStatus.ACTIVE
      : KnowledgeBaseStatus.DISABLED;

    if (kb.status === nextStatus) {
      return this.toResponse(kb);
    }

    const updated = await this.prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { status: nextStatus },
    });
    return this.toResponse(updated);
  }

  /** 内部辅助：找 KB 并校验当前 user 是 workspace 成员，供 Document 模块复用。 */
  async findOneForUser(
    userId: string,
    knowledgeBaseId: string,
  ): Promise<KnowledgeBase> {
    const kb = await this.findByIdOrThrow(knowledgeBaseId);
    await this.workspaceAccess.ensureMember(userId, kb.workspaceId);
    return kb;
  }

  private async findByIdOrThrow(knowledgeBaseId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });
    if (!kb) {
      throw new BusinessException(
        '知识库不存在',
        ErrorCode.KnowledgeBaseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    return kb;
  }

  private toResponse(kb: KnowledgeBase): KnowledgeBaseResponseDto {
    return {
      id: kb.id,
      workspaceId: kb.workspaceId,
      creatorId: kb.creatorId,
      name: kb.name,
      description: kb.description,
      enabled: kb.status === KnowledgeBaseStatus.ACTIVE,
      createdAt: formatShanghaiDateTime(kb.createdAt),
      updatedAt: formatShanghaiDateTime(kb.updatedAt),
    };
  }
}
