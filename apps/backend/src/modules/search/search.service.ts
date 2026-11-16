import { Injectable } from '@nestjs/common';
import {
  AgentStatus,
  KnowledgeBaseStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';

export type SearchItemType = 'agent' | 'workflow' | 'knowledge' | 'conversation';

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  description: string | null;
  updatedAt: string;
}

export interface SearchResultGroup {
  agents: SearchItem[];
  workflows: SearchItem[];
  knowledgeBases: SearchItem[];
  conversations: SearchItem[];
}

const SEARCH_ITEMS_LIMIT = 5;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async search(
    userId: string,
    workspaceId: string,
    keyword: string,
  ): Promise<SearchResultGroup> {
    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const kw = keyword.trim();
    if (!kw) {
      return { agents: [], workflows: [], knowledgeBases: [], conversations: [] };
    }

    const fuzzy = { contains: kw, mode: 'insensitive' as const };

    const [agents, workflows, knowledgeBases, conversations] = await Promise.all([
      this.prisma.agent.findMany({
        where: {
          workspaceId,
          status: { not: AgentStatus.ARCHIVED },
          OR: [{ name: fuzzy }, { description: fuzzy }],
        },
        orderBy: { updatedAt: 'desc' },
        take: SEARCH_ITEMS_LIMIT,
        select: { id: true, name: true, description: true, updatedAt: true },
      }),
      this.prisma.workflow.findMany({
        where: {
          workspaceId,
          OR: [{ name: fuzzy }, { description: fuzzy }],
        },
        orderBy: { updatedAt: 'desc' },
        take: SEARCH_ITEMS_LIMIT,
        select: { id: true, name: true, description: true, updatedAt: true },
      }),
      this.prisma.knowledgeBase.findMany({
        where: {
          workspaceId,
          status: { not: KnowledgeBaseStatus.ARCHIVED },
          OR: [{ name: fuzzy }, { description: fuzzy }],
        },
        orderBy: { updatedAt: 'desc' },
        take: SEARCH_ITEMS_LIMIT,
        select: { id: true, name: true, description: true, updatedAt: true },
      }),
      this.prisma.conversation.findMany({
        where: {
          agent: { workspaceId },
          isPreview: false,
          title: fuzzy,
        },
        orderBy: { updatedAt: 'desc' },
        take: SEARCH_ITEMS_LIMIT,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          agent: { select: { name: true } },
        },
      }),
    ]);

    return {
      agents: agents.map((agent) => ({
        id: agent.id,
        type: 'agent' as const,
        title: agent.name,
        description: agent.description,
        updatedAt: agent.updatedAt.toISOString(),
      })),
      workflows: workflows.map((workflow) => ({
        id: workflow.id,
        type: 'workflow' as const,
        title: workflow.name,
        description: workflow.description,
        updatedAt: workflow.updatedAt.toISOString(),
      })),
      knowledgeBases: knowledgeBases.map((kb) => ({
        id: kb.id,
        type: 'knowledge' as const,
        title: kb.name,
        description: kb.description,
        updatedAt: kb.updatedAt.toISOString(),
      })),
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        type: 'conversation' as const,
        title: conversation.title ?? '未命名对话',
        description: conversation.agent?.name
          ? `所属智能体：${conversation.agent.name}`
          : null,
        updatedAt: conversation.updatedAt.toISOString(),
      })),
    };
  }
}
