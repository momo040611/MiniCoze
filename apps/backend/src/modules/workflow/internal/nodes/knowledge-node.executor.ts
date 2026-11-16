import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { RetrievalService } from '../../../knowledge/retrieval/retrieval.service';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;
const DEFAULT_MIN_SCORE = 0;

// KnowledgeNodeExecutor：在工作流中检索知识库。
// 配置（data.inputs）：
// - query:            检索问题（支持 {{}} 模板）
// - knowledgeBaseIds: KB ID 数组（元素支持 {{}} 引用），至少一个
// - topK:             召回条数（默认 5，最大 20）
// - minScore:         相似度下限（默认 0）
//
// 输出：
// - results: 结构化结果数组（content/documentName/score 等）
// - summary: 拼接好的纯文本，供 LLM 节点直接引用（{{nodeId.output.summary}}）
@Injectable()
export class KnowledgeNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'knowledge';
  private readonly logger = new Logger(KnowledgeNodeExecutor.name);

  constructor(private readonly retrievalService: RetrievalService) {}

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const inputs = this.asRecord(this.asRecord(context.node.data).inputs);

    const query = context.resolveTemplate(this.readString(inputs.query, ''));
    if (!query.trim()) {
      throw new BusinessException(
        'knowledge 节点缺少 query',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const knowledgeBaseIds = this.resolveKnowledgeBaseIds(inputs, context);
    if (knowledgeBaseIds.length === 0) {
      throw new BusinessException(
        'knowledge 节点未配置 knowledgeBaseIds',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const topK = this.clampNumber(
      this.readNumber(inputs.topK, DEFAULT_TOP_K),
      1,
      MAX_TOP_K,
    );
    const minScore = this.readNumber(inputs.minScore, DEFAULT_MIN_SCORE);
    // variableContext.globalKey 约定为当前用户 ID，用于 KB 成员资格校验。
    const userId = context.state.variableContext.globalKey;

    this.logger.debug(
      `[knowledge] query="${query.slice(0, 100)}" kbs=${knowledgeBaseIds.length} topK=${topK}`,
    );

    const chunks = await this.retrievalService.search(userId, {
      knowledgeBaseIds,
      query,
      topK,
      minScore,
    });

    const results = chunks.map((chunk) => ({
      content: chunk.content,
      documentName: chunk.documentName,
      knowledgeBaseId: chunk.knowledgeBaseId,
      chunkIndex: chunk.index,
      score: chunk.score,
    }));

    const summary =
      chunks.length > 0
        ? chunks
            .map(
              (chunk, i) =>
                `[${i + 1}]（${chunk.documentName}）${chunk.content}`,
            )
            .join('\n---\n')
        : '（未检索到相关内容）';

    return {
      output: {
        query,
        count: results.length,
        results,
        summary,
      },
    };
  }

  private resolveKnowledgeBaseIds(
    inputs: Record<string, unknown>,
    context: WorkflowNodeExecutionContext,
  ): string[] {
    const rawList = Array.isArray(inputs.knowledgeBaseIds)
      ? inputs.knowledgeBaseIds
      : inputs.knowledgeBaseId !== undefined
        ? [inputs.knowledgeBaseId]
        : [];

    const ids: string[] = [];
    for (const raw of rawList) {
      const resolved = context.resolveValue(raw);
      if (typeof resolved === 'string' && resolved.trim()) {
        ids.push(resolved.trim());
      } else if (Array.isArray(resolved)) {
        for (const item of resolved) {
          if (typeof item === 'string' && item.trim()) {
            ids.push(item.trim());
          }
        }
      }
    }
    return [...new Set(ids)];
  }

  private clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (this.isRecord(value)) {
      return value;
    }
    return {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private readString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }

  private readNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return fallback;
  }
}
