import { HttpPluginExecutor } from '../http-plugin.executor';
import { SsrfGuard } from '../../../../common/utils/ssrf-guard';
import { PluginCredentialService } from '../../plugin-credential.service';

interface BuildOptions {
  fetchResponse: { status: number; body: unknown };
  credential?: {
    authType: string;
    secret: string;
    config: Record<string, unknown>;
  } | null;
}

function buildExecutor(options: BuildOptions) {
  const safeFetchMock = jest.fn().mockImplementation(async () => {
    return new Response(JSON.stringify(options.fetchResponse.body), {
      status: options.fetchResponse.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const validateUrlWithDnsMock = jest
    .fn()
    .mockImplementation(async (url: string) => url);

  const ssrfGuard = {
    validateUrlWithDns: validateUrlWithDnsMock,
    safeFetch: safeFetchMock,
  } as unknown as SsrfGuard;

  const pluginCredentialService = {
    getRuntimeCredential: jest
      .fn()
      .mockResolvedValue(options.credential ?? null),
  } as unknown as PluginCredentialService;

  return {
    executor: new HttpPluginExecutor(ssrfGuard, pluginCredentialService),
    safeFetchMock,
  };
}

describe('HttpPluginExecutor', () => {
  const toolMeta = {
    handler: 'http',
    request: {
      method: 'GET',
      url: 'https://api.example.com/weather?city={{city}}',
      headers: { 'X-Trace': 'mini-{{city}}' },
      responsePath: 'data.result',
      timeoutMs: 5000,
    },
  };

  it('URL 与 header 模板插值 + responsePath 截取 + 无凭据时不带认证头', async () => {
    const { executor, safeFetchMock } = buildExecutor({
      fetchResponse: {
        status: 200,
        body: { code: 0, data: { result: 'sunny 28C' } },
      },
    });

    const output = await executor.execute({
      pluginId: 'p1',
      toolMeta,
      args: { city: 'hangzhou' },
    });

    expect(output).toBe('sunny 28C');

    const [calledUrl, init] = safeFetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe('https://api.example.com/weather?city=hangzhou');
    expect((init.headers as Record<string, string>)['X-Trace']).toBe(
      'mini-hangzhou',
    );
    expect(
      (init.headers as Record<string, string>)['Authorization'],
    ).toBeUndefined();
  });

  it('存在 BEARER_TOKEN 凭据 → 注入 Authorization 头', async () => {
    const { executor, safeFetchMock } = buildExecutor({
      fetchResponse: { status: 200, body: { ok: true } },
      credential: { authType: 'BEARER_TOKEN', secret: 'sk-secret', config: {} },
    });

    await executor.execute({
      pluginId: 'p1',
      toolMeta,
      args: { city: 'hangzhou' },
    });

    const [, init] = safeFetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer sk-secret',
    );
  });

  it('API_KEY_HEADER 凭据 → 使用 config.headerName 注入', async () => {
    const { executor, safeFetchMock } = buildExecutor({
      fetchResponse: { status: 200, body: { ok: true } },
      credential: {
        authType: 'API_KEY_HEADER',
        secret: 'key-123',
        config: { headerName: 'X-Api-Key' },
      },
    });

    await executor.execute({
      pluginId: 'p1',
      toolMeta,
      args: { city: 'hz' },
    });

    const [, init] = safeFetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Api-Key']).toBe(
      'key-123',
    );
  });

  it('非 2xx → 抛错并包含状态码', async () => {
    const { executor } = buildExecutor({
      fetchResponse: { status: 500, body: { error: 'boom' } },
    });

    await expect(
      executor.execute({ pluginId: 'p1', toolMeta, args: { city: 'hz' } }),
    ).rejects.toThrow(/500/);
  });

  it('POST body 支持 {{args}} 深层插值', async () => {
    const { executor, safeFetchMock } = buildExecutor({
      fetchResponse: { status: 200, body: { ok: true } },
    });

    await executor.execute({
      pluginId: 'p1',
      toolMeta: {
        request: {
          method: 'POST',
          url: 'https://api.example.com/search',
          body: { query: '{{q}}, page: {{page}}', limit: 10 },
        },
      },
      args: { q: 'weather', page: 2 },
    });

    const [, init] = safeFetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      query: string;
      limit: number;
    };
    expect(body.query).toBe('weather, page: 2');
    expect(body.limit).toBe(10);
  });
});
