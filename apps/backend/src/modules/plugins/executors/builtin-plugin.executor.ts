import { Injectable } from '@nestjs/common';
import { BingWebSearchClient } from '../builtin/bing-web-search.client';

type BuiltinToolHandler = (args: Record<string, unknown>) => unknown;

@Injectable()
export class BuiltinPluginExecutor {
  private readonly handlers = new Map<string, BuiltinToolHandler>();

  constructor(private readonly bingWebSearchClient: BingWebSearchClient) {
    this.register('echo_text', (args) => ({
      text:
        typeof args.text === 'string'
          ? args.text
          : typeof args.value === 'string'
            ? args.value
            : JSON.stringify(args),
    }));
    this.register('time_now', () => ({
      now: new Date().toISOString(),
    }));
    this.register('bing_web_search', (args) =>
      this.bingWebSearchClient.searchWebpages({
        query: typeof args.query === 'string' ? args.query : '',
        count: typeof args.count === 'number' ? args.count : undefined,
        mkt: typeof args.mkt === 'string' ? args.mkt : undefined,
        freshness:
          args.freshness === 'Day' ||
          args.freshness === 'Week' ||
          args.freshness === 'Month'
            ? args.freshness
            : undefined,
        safeSearch:
          args.safeSearch === 'Off' ||
          args.safeSearch === 'Moderate' ||
          args.safeSearch === 'Strict'
            ? args.safeSearch
            : undefined,
      }),
    );
    this.register('bing_page_summary', (args) =>
      this.bingWebSearchClient.summarizePage({
        url: typeof args.url === 'string' ? args.url : '',
        maxChars: typeof args.maxChars === 'number' ? args.maxChars : undefined,
      }),
    );
    this.register('bing_paged_search', (args) =>
      this.bingWebSearchClient.pagedSearch({
        query: typeof args.query === 'string' ? args.query : '',
        page: typeof args.page === 'number' ? args.page : undefined,
        pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
        mkt: typeof args.mkt === 'string' ? args.mkt : undefined,
        freshness:
          args.freshness === 'Day' ||
          args.freshness === 'Week' ||
          args.freshness === 'Month'
            ? args.freshness
            : undefined,
        safeSearch:
          args.safeSearch === 'Off' ||
          args.safeSearch === 'Moderate' ||
          args.safeSearch === 'Strict'
            ? args.safeSearch
            : undefined,
      }),
    );
  }

  register(name: string, handler: BuiltinToolHandler): void {
    this.handlers.set(name, handler);
  }

  supports(type: string): boolean {
    return type === 'BUILTIN';
  }

  async execute(input: {
    functionName: string;
    toolCode: string;
    handlerKey?: string;
    args: Record<string, unknown>;
  }): Promise<unknown> {
    const candidates = [
      input.handlerKey,
      input.functionName,
      input.toolCode,
    ].filter((item): item is string => Boolean(item));

    for (const key of candidates) {
      const handler = this.handlers.get(key);
      if (handler) {
        return await Promise.resolve(handler(input.args));
      }
    }

    throw new Error(`Builtin tool not registered: ${input.functionName}`);
  }
}
