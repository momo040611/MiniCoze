import type { ConfigService } from '@nestjs/config';
import type { Embedder } from './embedder.interface';
import { OpenAiCompatibleEmbedder } from './openai-compatible.embedder';

function getRequiredConfig(
  configService: ConfigService,
  key: string,
): string {
  const value = configService.get<string>(key, { infer: true })?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * 从环境变量构造默认 Embedder。NestJS 通过 useFactory + EMBEDDER_TOKEN 注入。
 * env.validation 已确保所有必填项存在并类型正确。
 */
export function createEmbedder(configService: ConfigService): Embedder {
  return new OpenAiCompatibleEmbedder({
    baseUrl: getRequiredConfig(configService, 'EMBEDDING_BASE_URL'),
    apiKey: getRequiredConfig(configService, 'EMBEDDING_API_KEY'),
    model: getRequiredConfig(configService, 'EMBEDDING_MODEL'),
    dimensions: configService.get<number>('EMBEDDING_DIM', { infer: true })!,
    batchSize:
      configService.get<number>('EMBEDDING_BATCH_SIZE', { infer: true }) ?? 32,
  });
}
