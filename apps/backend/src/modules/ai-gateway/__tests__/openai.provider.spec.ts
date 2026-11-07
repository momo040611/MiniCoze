import { HttpStatus } from '@nestjs/common';
import { OpenAiProvider } from '../providers/openai.provider';
import type { AiGenerateRequest, AiProviderConfig } from '../types';

const baseConfig: AiProviderConfig = {
  baseUrl: 'http://fake-llm.local',
  apiKey: 'test-key',
  defaultModel: 'test-model',
} as AiProviderConfig;

function makeRequest(): AiGenerateRequest {
  return { messages: [{ role: 'user', content: 'hi' }] } as AiGenerateRequest;
}

describe('OpenAiProvider 超时保护', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('上游一直不返回时，按超时失败而不是永远挂住', async () => {
    // 造一个「接受请求但永不返回」的 fetch
    global.fetch = jest.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('The operation was aborted.');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;

    const provider = new OpenAiProvider(baseConfig, 20);

    await expect(provider.generate(makeRequest())).rejects.toMatchObject({
      status: HttpStatus.GATEWAY_TIMEOUT,
      message: expect.stringContaining('模型请求超时'),
    });
  });

  it('上游正常返回时不受影响（对照组）', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello' } }],
        model: 'test-model',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    }) as unknown as typeof fetch;

    const provider = new OpenAiProvider(baseConfig, 1000);
    const result = await provider.generate(makeRequest());

    expect(result.content).toBe('hello');
  });
});