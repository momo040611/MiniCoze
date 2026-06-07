// 文档向量化抽象。
// 实现需保证 vector 长度与 dimensions 一致；任何失败抛 BusinessException(KnowledgeEmbeddingFailed)。

export const EMBEDDER_TOKEN = Symbol('EMBEDDER_TOKEN');

export interface Embedder {
  readonly model: string;
  readonly dimensions: number;
  /** 输入文本数组，输出等长 vectors（按原顺序）。空输入返回空数组。 */
  embed(texts: string[]): Promise<number[][]>;
}
