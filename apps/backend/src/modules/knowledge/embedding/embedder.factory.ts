import type { ConfigService } from '@nestjs/config';
import type { Embedder } from './embedder.interface';
import { OpenAiCompatibleEmbedder } from './openai-compatible.embedder';

/**
 * 从环境变量构造默认 Embedder。NestJS 通过 useFactory + EMBEDDER_TOKEN 注入。
 * env.validation 已确保所有必填项存在并类型正确。
 */
export function createEmbedder(configService: ConfigService): Embedder {
  return new OpenAiCompatibleEmbedder({
    baseUrl: configService.get<string>('EMBEDDING_BASE_URL', { infer: true })!,
    apiKey: configService.get<string>('EMBEDDING_API_KEY', { infer: true })!,
    model: configService.get<string>('EMBEDDING_MODEL', { infer: true })!,
    dimensions: configService.get<number>('EMBEDDING_DIM', { infer: true })!,
    batchSize:
      configService.get<number>('EMBEDDING_BATCH_SIZE', { infer: true }) ?? 32,
  });
}
