import { Injectable, Logger } from '@nestjs/common';
import type {
  ChatMessage,
  RuntimeKnowledgeBinding,
} from '../../../shared/types/agent';
import type { RuntimeContext } from '../../../shared/types/runtime';
import {
  RetrievalService,
  type RetrievedChunk,
} from '../../knowledge/retrieval/retrieval.service';

const DEFAULT_TOP_K = 4;
const DEFAULT_MIN_SCORE = 0.3;
const MAX_TOTAL_CHUNKS = 8;

@Injectable()
export class RuntimeKnowledgeService {
  private readonly logger = new Logger(RuntimeKnowledgeService.name);

  constructor(private readonly retrievalService: RetrievalService) {}

  async buildKnowledgeSystemMessage(input: {
    context: RuntimeContext;
    query: string;
  }): Promise<ChatMessage | null> {
    const bindings = (input.context.agentConfig.knowledgeBindings ?? []).filter(
      (binding) => binding.enabled,
    );

    if (!bindings.length || !input.query.trim()) {
      return null;
    }

    const chunkGroups = await Promise.all(
      bindings.map((binding) =>
        this.retrieveBindingChunks(input.context, binding, input.query),
      ),
    );
    const chunks = this.mergeChunks(chunkGroups.flat());

    if (!chunks.length) {
      return null;
    }

    return {
      role: 'system',
      content: this.formatKnowledgePrompt(chunks),
    };
  }

  private async retrieveBindingChunks(
    context: RuntimeContext,
    binding: RuntimeKnowledgeBinding,
    query: string,
  ): Promise<RetrievedChunk[]> {
    try {
      return await this.retrievalService.search(context.userId, {
        knowledgeBaseIds: [binding.knowledgeBaseId],
        query,
        topK: binding.config?.topK ?? DEFAULT_TOP_K,
        minScore: binding.config?.minScore ?? DEFAULT_MIN_SCORE,
      });
    } catch (error) {
      this.logger.warn(
        `Knowledge retrieval skipped for binding ${binding.bindingId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private mergeChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const chunkMap = new Map<string, RetrievedChunk>();

    for (const chunk of chunks) {
      const existing = chunkMap.get(chunk.chunkId);
      if (!existing || chunk.score > existing.score) {
        chunkMap.set(chunk.chunkId, chunk);
      }
    }

    return Array.from(chunkMap.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_TOTAL_CHUNKS);
  }

  private formatKnowledgePrompt(chunks: RetrievedChunk[]): string {
    const sections = chunks.map((chunk, index) => {
      const score = Number.isFinite(chunk.score) ? chunk.score.toFixed(3) : '0';

      return [
        `[${index + 1}] knowledgeBase=${chunk.knowledgeBaseId} document=${chunk.documentName} chunk=${chunk.index} score=${score}`,
        chunk.content,
      ].join('\n');
    });

    return [
      'Use the following retrieved knowledge snippets when they are relevant to the user request.',
      'If the snippets are not relevant, ignore them instead of forcing an answer.',
      '',
      ...sections,
    ].join('\n');
  }
}
