import { Injectable, Logger } from '@nestjs/common';
import { MessageRole as PrismaMessageRole } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { ChatMessage } from '../../../shared/types/agent';
import type { RuntimeContext } from '../../../shared/types/runtime';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';

interface ConversationMemoryState {
  recentMessages: ChatMessage[];
  memoryMessage: ChatMessage | null;
}

const SUMMARY_PROMPT = [
  '你是对话摘要助手。请把下面的历史对话压缩成一段简洁的摘要，',
  '保留关键事实、用户偏好、做出的决定和未完成的任务，丢弃寒暄与重复内容。',
  '直接输出摘要正文，不要任何前缀或解释。',
].join('');

// ConversationMemoryService：长期记忆 v1（会话摘要压缩）。
//
// 策略：
// - 历史消息数 <= contextLimit：不需要摘要，直接全量注入。
// - 超出时：把超出部分（较早的消息）增量摘要到 Conversation.memorySummary，
//   运行时以 system 消息形式注入「历史摘要」，配合最近 contextLimit 条消息。
// - 摘要带游标（memorySummaryCount）：只对新落入截断区的消息增量总结，避免重复开销。
// - 摘要失败不阻断运行：记日志后按无摘要降级。
@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger(ConversationMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async buildMemory(
    context: RuntimeContext,
    contextLimit: number,
  ): Promise<ConversationMemoryState> {
    const allMessages = await this.loadDialogMessages(context.conversationId);

    // 消息总数没有超过保留窗口：全量作为 history，不需要摘要。
    if (allMessages.length <= contextLimit) {
      return { recentMessages: allMessages, memoryMessage: null };
    }

    const olderCount = allMessages.length - contextLimit;
    const recentMessages = allMessages.slice(olderCount);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: context.conversationId },
      select: { memorySummary: true, memorySummaryCount: true },
    });

    // 摘要游标已覆盖所有截断消息：直接复用，不调 LLM。
    const storedSummary = conversation?.memorySummary ?? null;
    const storedCount = conversation?.memorySummaryCount ?? 0;
    if (storedSummary && storedCount >= olderCount) {
      return {
        recentMessages,
        memoryMessage: this.toMemoryMessage(storedSummary),
      };
    }

    try {
      const summary = await this.summarize(
        storedSummary,
        allMessages.slice(storedCount, olderCount),
      );
      if (!summary) {
        return { recentMessages, memoryMessage: null };
      }

      await this.prisma.conversation.update({
        where: { id: context.conversationId },
        data: {
          memorySummary: summary,
          memorySummaryCount: olderCount,
        },
      });

      return {
        recentMessages,
        memoryMessage: this.toMemoryMessage(summary),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`会话摘要生成失败（降级为无摘要）: ${message.slice(0, 300)}`);
      return { recentMessages, memoryMessage: null };
    }
  }

  private async loadDialogMessages(conversationId: string): Promise<ChatMessage[]> {
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        role: { in: [PrismaMessageRole.USER, PrismaMessageRole.ASSISTANT] },
      },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    return rows
      .filter((row) => (row.content ?? '').trim().length > 0)
      .map((row) => ({
        role: row.role === PrismaMessageRole.USER ? 'user' : 'assistant',
        content: row.content,
      }));
  }

  private async summarize(
    previousSummary: string | null,
    newMessages: ChatMessage[],
  ): Promise<string | null> {
    if (newMessages.length === 0) {
      return previousSummary;
    }

    const dialog = newMessages
      .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`)
      .join('\n');

    const prompt = previousSummary
      ? `已有的早期对话摘要：\n${previousSummary}\n\n以下是新增的历史对话：\n${dialog}\n\n请合并成一份新的完整摘要。`
      : `以下是需要摘要的历史对话：\n${dialog}`;

    const response = await this.aiGateway.generate({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      maxTokens: 1024,
    });

    const summary = (response.content ?? '').trim();
    return summary.length > 0 ? summary.slice(0, 8000) : null;
  }

  private toMemoryMessage(summary: string): ChatMessage {
    return {
      role: 'system',
      content: `以下是本次对话更早内容的摘要（原始消息因超出上下文窗口被截断）：\n${summary}`,
    };
  }
}
