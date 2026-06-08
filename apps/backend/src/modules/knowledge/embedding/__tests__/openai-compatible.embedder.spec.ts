import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { OpenAiCompatibleEmbedder } from '../openai-compatible.embedder';

const buildVector = (n: number, fill = 0.1): number[] =>
  Array.from({ length: n }, () => fill);

const buildEmbeddingResponse = (vectors: number[][]) => ({
  data: vectors.map((v, i) => ({
    index: i,
    embedding: v,
    object: 'embedding',
  })),
  model: 'mock',
  object: 'list',
  usage: { prompt_tokens: 0, total_tokens: 0 },
});

const okResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

const errResponse = (status: number, body: unknown) =>
  ({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

describe('OpenAiCompatibleEmbedder', () => {
  const baseConfig = {
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'sk-test',
    model: 'BAAI/bge-large-zh-v1.5',
    dimensions: 1024,
    batchSize: 32,
  };

  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('单批输入：3 条文本 → 返回 3 个 vector，顺序保持', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(
        buildEmbeddingResponse([
          buildVector(1024, 0.1),
          buildVector(1024, 0.2),
          buildVector(1024, 0.3),
        ]),
      ),
    );

    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    const out = await embedder.embed(['a', 'b', 'c']);

    expect(out).toHaveLength(3);
    expect(out[0][0]).toBeCloseTo(0.1);
    expect(out[1][0]).toBeCloseTo(0.2);
    expect(out[2][0]).toBeCloseTo(0.3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('分批：70 条 + batchSize=32 → fetch 调 3 次，合并后 70 条且顺序正确', async () => {
    const inputs = Array.from({ length: 70 }, (_, i) => `t${i}`);
    fetchMock
      .mockResolvedValueOnce(
        okResponse(
          buildEmbeddingResponse(
            Array.from({ length: 32 }, (_, i) => buildVector(1024, i / 100)),
          ),
        ),
      )
      .mockResolvedValueOnce(
        okResponse(
          buildEmbeddingResponse(
            Array.from({ length: 32 }, (_, i) =>
              buildVector(1024, (i + 32) / 100),
            ),
          ),
        ),
      )
      .mockResolvedValueOnce(
        okResponse(
          buildEmbeddingResponse(
            Array.from({ length: 6 }, (_, i) =>
              buildVector(1024, (i + 64) / 100),
            ),
          ),
        ),
      );

    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    const out = await embedder.embed(inputs);

    expect(out).toHaveLength(70);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(out[0][0]).toBeCloseTo(0);
    expect(out[35][0]).toBeCloseTo(35 / 100);
    expect(out[69][0]).toBeCloseTo(69 / 100);
  });

  it('空输入：不调 fetch，直接返回空数组', async () => {
    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    const out = await embedder.embed([]);
    expect(out).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('单条输入：1 次 fetch，1 个 vector', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(buildEmbeddingResponse([buildVector(1024)])),
    );
    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    const out = await embedder.embed(['only']);
    expect(out).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('恰好 batchSize 倍数：仅 1 次 fetch（input.length === batchSize）', async () => {
    const inputs = Array.from({ length: 32 }, (_, i) => `t${i}`);
    fetchMock.mockResolvedValueOnce(
      okResponse(
        buildEmbeddingResponse(
          Array.from({ length: 32 }, () => buildVector(1024)),
        ),
      ),
    );
    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    await embedder.embed(inputs);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('HTTP 401：抛 BusinessException(KnowledgeEmbeddingFailed)，message 含 provider 错误', async () => {
    fetchMock.mockResolvedValueOnce(
      errResponse(401, {
        error: { message: 'invalid api key', type: 'auth_error' },
      }),
    );

    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    await expect(embedder.embed(['x'])).rejects.toMatchObject({
      message: expect.stringContaining('invalid api key'),
    });
    try {
      await embedder.embed(['x']);
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessException);
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }
  });

  it('返回 data 长度与 input 长度不一致：抛 KnowledgeEmbeddingFailed', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(buildEmbeddingResponse([buildVector(1024)])),
    );
    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    await expect(embedder.embed(['a', 'b'])).rejects.toBeInstanceOf(
      BusinessException,
    );
  });

  it('返回 vector 维度与配置 dimensions 不符：抛 KnowledgeEmbeddingFailed', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(buildEmbeddingResponse([buildVector(512)])),
    );
    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    await expect(embedder.embed(['a'])).rejects.toMatchObject({
      message: expect.stringContaining('dimension'),
    });
  });

  it('网络异常：抛 KnowledgeEmbeddingFailed', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    try {
      await embedder.embed(['a']);
      fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessException);
      expect((e as BusinessException).getErrorCode()).toBe(
        ErrorCode.KnowledgeEmbeddingFailed,
      );
    }
  });

  it('请求体形状：POST {baseUrl}/embeddings，body 含 model + input', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(buildEmbeddingResponse([buildVector(1024)])),
    );
    const embedder = new OpenAiCompatibleEmbedder(baseConfig);
    await embedder.embed(['hello']);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/embeddings$/);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('BAAI/bge-large-zh-v1.5');
    expect(body.input).toEqual(['hello']);
  });
});
