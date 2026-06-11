import { HttpStatus, Injectable } from '@nestjs/common';
import { MessageRole as PrismaMessageRole } from '@prisma/client';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { PrismaService } from '../../../database/prisma.service';
import {
  ChatMessage,
  RuntimeRunStatus,
  TokenUsage,
} from '../../../shared/types/agent';
import type {
  RuntimeContext,
  RuntimeRepository,
} from '../../../shared/types/runtime';

@Injectable()
export class RuntimePrismaRepository implements RuntimeRepository {
  private readonly runs = new Map<string, RuntimeContext>();

  constructor(private readonly prisma: PrismaService) {}

  async saveRun(context: RuntimeContext): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: {
        id: context.conversationId,
      },
    });

    if (conversation) {
      const invalidConversation = context.publicAccess
        ? conversation.agentId !== context.agentId ||
          conversation.isPreview ||
          !conversation.id.startsWith(context.publicAccess.conversationIdPrefix)
        : conversation.agentId !== context.agentId ||
          conversation.userId !== context.userId ||
          conversation.isPreview !== (context.isPreview ?? false);

      if (invalidConversation) {
        throw new BusinessException(
          'Conversation does not match current runtime context',
          ErrorCode.Forbidden,
          HttpStatus.FORBIDDEN,
        );
      }

      await this.prisma.conversation.update({
        where: {
          id: context.conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.conversation.create({
        data: {
          id: context.conversationId,
          agentId: context.agentId,
          userId: context.userId,
          isPreview: context.isPreview ?? false,
          title: context.input.content?.slice(0, 50),
        },
      });
    }

    this.runs.set(context.runId, context);
  }

  async updateRunStatus(
    runId: string,
    status: RuntimeRunStatus,
    usage?: TokenUsage,
    error?: string,
  ): Promise<void> {
    const context = this.runs.get(runId);
    if (!context) return;

    context.status = status;
    if (usage) {
      context.usage = usage;
      await this.updateLatestAssistantUsage(context, usage);
    }

    if (status === 'failed' && error) {
      await this.createMessage(
        context,
        {
          role: 'assistant',
          content: '',
        },
        error,
      );
    }

    if (
      status === 'completed' ||
      status === 'failed' ||
      status === 'canceled'
    ) {
      this.runs.delete(runId);
    }
  }

  async appendMessage(runId: string, message: ChatMessage): Promise<void> {
    const context = this.runs.get(runId);
    if (!context || message.role === 'tool') return;

    await this.createMessage(context, message);
  }

  async getConversationHistory(
    conversationId: string,
    limit?: number,
  ): Promise<ChatMessage[]> {
    if (limit !== undefined && limit <= 0) {
      return [];
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const limitedMessages =
      limit === undefined ? messages : messages.slice(-limit);

    return limitedMessages.map((message) => ({
      role: this.toRuntimeRole(message.role),
      content: message.content,
    }));
  }

  private async createMessage(
    context: RuntimeContext,
    message: ChatMessage,
    errorMessage?: string,
  ): Promise<void> {
    const role = this.toPrismaRole(message.role);
    if (!role) return;

    const attachments = context.attachments?.map((attachment) => ({
      fileId: attachment.fileId,
      ...(attachment.name ? { name: attachment.name } : {}),
      ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
      ...(attachment.size !== undefined ? { size: attachment.size } : {}),
    }));

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: context.conversationId,
          role,
          content: message.content ?? '',
          model:
            message.role === 'assistant'
              ? context.agentConfig.model
              : undefined,
          metadata:
            message.role === 'user' && attachments?.length
              ? { attachments }
              : undefined,
          errorMessage,
        },
      }),
      this.prisma.conversation.update({
        where: {
          id: context.conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  private async updateLatestAssistantUsage(
    context: RuntimeContext,
    usage: TokenUsage,
  ): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: {
        conversationId: context.conversationId,
        role: PrismaMessageRole.ASSISTANT,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!message) return;

    await this.prisma.message.update({
      where: {
        id: message.id,
      },
      data: {
        tokenUsage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        },
      },
    });
  }

  private toPrismaRole(role: ChatMessage['role']): PrismaMessageRole | null {
    switch (role) {
      case 'system':
        return PrismaMessageRole.SYSTEM;
      case 'user':
        return PrismaMessageRole.USER;
      case 'assistant':
        return PrismaMessageRole.ASSISTANT;
      case 'tool':
        return null;
    }
  }

  private toRuntimeRole(role: PrismaMessageRole): ChatMessage['role'] {
    switch (role) {
      case PrismaMessageRole.SYSTEM:
        return 'system';
      case PrismaMessageRole.USER:
        return 'user';
      case PrismaMessageRole.ASSISTANT:
        return 'assistant';
      case PrismaMessageRole.TOOL:
        return 'tool';
    }
  }
}
