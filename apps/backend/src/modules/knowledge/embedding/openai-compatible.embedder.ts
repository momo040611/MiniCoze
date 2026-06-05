import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import type { Embedder } from './embedder.interface';

export interface OpenAiCompatibleEmbedderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  batchSize: number;
}

interface EmbeddingApiSuccess {
  data: Array<{ index: number; embedding: number[]; object: string }>;
}

interface EmbeddingApiError {
  error?: { message?: string; type?: string; code?: string };
  message?: string;
}

/**
 * OpenAI 兼容的 embedding HTTP 客户端，可对接：
 *   - 硅基流动 (https://api.siliconflow.cn/v1)
 *   - 阿里 DashScope 兼容模式 (https://dashscope.aliyuncs.com/compatible-mode/v1)
 *   - OpenAI 官方 (https://api.openai.com/v1)
 *
 * 失败统一抛 BusinessException(KnowledgeEmbeddingFailed)。
 */
export class OpenAiCompatibleEmbedder implements Embedder {
  readonly model: string;
  readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly batchSize: number;

  constructor(config: OpenAiCompatibleEmbedderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.dimensions = Number(config.dimensions);
    this.batchSize = Math.max(1, Number(config.batchSize));
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const vectors = await this.callBatch(batch);
      out.push(...vectors);
    }
    return out;
  }

  private async callBatch(batch: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/embeddings`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: batch }),
      });
    } catch (e) {
      // Node fetch 失败时真正原因藏在 error.cause（undici 错误）。
      // 例如 ENOTFOUND / ECONNREFUSED / CERT_HAS_EXPIRED 等。
      const top = e instanceof Error ? e.message : String(e);
      const cause =
        e instanceof Error && 'cause' in e && e.cause
          ? ` (cause: ${e.cause instanceof Error ? `${e.cause.name}: ${e.cause.message}` : String(e.cause)})`
          : '';
      throw new BusinessException(
        `embedding request failed: ${top}${cause} | url=${url}`,
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }

    if (!response.ok) {
      let providerMsg = `HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as EmbeddingApiError;
        const msg = errBody.error?.message ?? errBody.message;
        if (msg) providerMsg = `${providerMsg}: ${msg}`;
      } catch {
        // ignore body parse failure
      }
      throw new BusinessException(
        `embedding provider error: ${providerMsg}`,
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }

    let body: EmbeddingApiSuccess;
    try {
      body = (await response.json()) as EmbeddingApiSuccess;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      throw new BusinessException(
        `embedding response parse failed: ${reason}`,
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }

    if (!Array.isArray(body.data) || body.data.length !== batch.length) {
      throw new BusinessException(
        `embedding response data length mismatch: expected ${batch.length}, got ${body.data?.length ?? 0}`,
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }

    // 部分提供商不保证 data[i].index 与 input 顺序一致 → 显式按 index 排序回填。
    const indexed = body.data
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    const vectors: number[][] = [];
    for (let i = 0; i < indexed.length; i++) {
      const v = indexed[i].embedding;
      if (!Array.isArray(v) || v.length !== this.dimensions) {
        throw new BusinessException(
          `embedding dimension mismatch at index ${i}: expected ${this.dimensions}, got ${v?.length ?? 0}`,
          ErrorCode.KnowledgeEmbeddingFailed,
        );
      }
      vectors.push(v);
    }
    return vectors;
  }
}
