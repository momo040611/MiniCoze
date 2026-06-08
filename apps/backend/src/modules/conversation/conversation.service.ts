import { HttpStatus, Injectable } from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/constants/error-code';
import { PrismaService } from '../../database/prisma.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { WorkspaceAccessService } from '../workspace/workspace-access.service';
import { CreateConversationDto, SendMessageDto } from './dto';
import { AiMessage } from '../ai-gateway/types';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async create(
    userId: string,
    workspaceId: string,
    dto: CreateConversationDto,
  ) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: dto.agentId },
      include: { workspace: true },
    });

    if (!agent || agent.workspaceId !== workspaceId) {
      throw new BusinessException(
        'Agent 不存在或不在该工作空间',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const conversation = await this.prisma.conversation.create({
      data: {
        agentId: dto.agentId,
        userId,
        title: dto.content.slice(0, 50),
      },
    });

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: dto.content,
      },
    });

    const messages: AiMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: dto.content },
    ];

    const aiResponse = await this.aiGatewayService.generate({
      model: agent.model,
      messages,
      temperature: agent.temperature,
    });

    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: aiResponse.content,
        model: aiResponse.model,
        tokenUsage: aiResponse.usage
          ? {
              promptTokens: aiResponse.usage.promptTokens,
              completionTokens: aiResponse.usage.completionTokens,
              totalTokens: aiResponse.usage.totalTokens,
            }
          : undefined,
      },
    });

    return {
      conversation,
      userMessage: dto.content,
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        model: assistantMessage.model,
        createdAt: assistantMessage.createdAt,
      },
    };
  }

  async sendMessage(
    userId: string,
    workspaceId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { agent: true },
    });

    if (!conversation || conversation.agent.workspaceId !== workspaceId) {
      throw new BusinessException(
        '对话不存在或不在该工作空间',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    if (conversation.userId !== userId) {
      throw new BusinessException(
        '无权访问该对话',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    const history = await this.getRecentMessages(
      conversationId,
      conversation.agent.contextLimit,
    );

    await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: dto.content,
      },
    });

    const messages: AiMessage[] = [
      { role: 'system', content: conversation.agent.systemPrompt },
      ...history.map((msg): AiMessage => {
        return {
          role:
            msg.role === MessageRole.SYSTEM
              ? 'system'
              : msg.role === MessageRole.USER
                ? 'user'
                : 'assistant',
          content: msg.content,
        };
      }),
      { role: 'user', content: dto.content },
    ];

    const aiResponse = await this.aiGatewayService.generate({
      model: conversation.agent.model,
      messages,
      temperature: conversation.agent.temperature,
    });

    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: aiResponse.content,
        model: aiResponse.model,
        tokenUsage: aiResponse.usage
          ? {
              promptTokens: aiResponse.usage.promptTokens,
              completionTokens: aiResponse.usage.completionTokens,
              totalTokens: aiResponse.usage.totalTokens,
            }
          : undefined,
      },
    });

    return {
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      model: assistantMessage.model,
      createdAt: assistantMessage.createdAt,
    };
  }

  async findOne(userId: string, workspaceId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { agent: true, messages: true },
    });

    if (!conversation || conversation.agent.workspaceId !== workspaceId) {
      throw new BusinessException(
        '对话不存在或不在该工作空间',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    if (conversation.userId !== userId) {
      throw new BusinessException(
        '无权访问该对话',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    return conversation;
  }

  async findByAgent(
    userId: string,
    workspaceId: string,
    agentId: string,
    preview = false,
  ) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.workspaceId !== workspaceId) {
      throw new BusinessException(
        'Agent 不存在或不在该工作空间',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    return this.prisma.conversation.findMany({
      where: { agentId, userId, isPreview: preview },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        agentId: true,
        userId: true,
        title: true,
        isPreview: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { content: true, role: true, createdAt: true },
        },
      },
    });
  }

  async remove(userId: string, workspaceId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { agent: true },
    });

    if (!conversation || conversation.agent.workspaceId !== workspaceId) {
      throw new BusinessException(
        'Conversation not found in workspace',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    if (conversation.userId !== userId) {
      throw new BusinessException(
        'No permission to access this conversation',
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.workspaceAccessService.ensureMember(userId, workspaceId);

    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });

    return {
      id: conversationId,
      deleted: true,
    };
  }

  private async getRecentMessages(conversationId: string, limit: number) {
    if (limit <= 0) {
      return [];
    }

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse();
  }
}
