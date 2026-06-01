import { Injectable } from '@nestjs/common';
import { BingWebSearchClient } from '../builtin/bing-web-search.client';
import { ImageUnderstandingClient } from '../builtin/image-understanding.client';
import type { RuntimeContext } from '../../../shared/types/runtime';

type BuiltinToolHandler = (
  args: Record<string, unknown>,
  context?: RuntimeContext,
) => unknown;

@Injectable()
export class BuiltinPluginExecutor {
  private readonly handlers = new Map<string, BuiltinToolHandler>();

  constructor(
    private readonly bingWebSearchClient: BingWebSearchClient,
    private readonly imageUnderstandingClient: ImageUnderstandingClient,
  ) {
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
    this.register('image_ocr', (args, context) =>
      this.imageUnderstandingClient.extractOcrText(
        {
          imageUrl:
            typeof args.imageUrl === 'string' ? args.imageUrl : undefined,
          fileId: typeof args.fileId === 'string' ? args.fileId : undefined,
          detail:
            args.detail === 'low' ||
            args.detail === 'high' ||
            args.detail === 'auto'
              ? args.detail
              : undefined,
          question:
            typeof args.question === 'string' ? args.question : undefined,
        },
        context,
      ),
    );
    this.register('screenshot_parse', (args, context) =>
      this.imageUnderstandingClient.analyzeScreenshot(
        {
          imageUrl:
            typeof args.imageUrl === 'string' ? args.imageUrl : undefined,
          fileId: typeof args.fileId === 'string' ? args.fileId : undefined,
          detail:
            args.detail === 'low' ||
            args.detail === 'high' ||
            args.detail === 'auto'
              ? args.detail
              : undefined,
          question:
            typeof args.question === 'string' ? args.question : undefined,
        },
        context,
      ),
    );
    this.register('chart_data_analysis', (args, context) =>
      this.imageUnderstandingClient.analyzeChartData(
        {
          imageUrl:
            typeof args.imageUrl === 'string' ? args.imageUrl : undefined,
          fileId: typeof args.fileId === 'string' ? args.fileId : undefined,
          detail:
            args.detail === 'low' ||
            args.detail === 'high' ||
            args.detail === 'auto'
              ? args.detail
              : undefined,
          question:
            typeof args.question === 'string' ? args.question : undefined,
        },
        context,
      ),
    );
    this.register('scene_description', (args, context) =>
      this.imageUnderstandingClient.describeScene(
        {
          imageUrl:
            typeof args.imageUrl === 'string' ? args.imageUrl : undefined,
          fileId: typeof args.fileId === 'string' ? args.fileId : undefined,
          detail:
            args.detail === 'low' ||
            args.detail === 'high' ||
            args.detail === 'auto'
              ? args.detail
              : undefined,
          question:
            typeof args.question === 'string' ? args.question : undefined,
        },
        context,
      ),
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
    context?: RuntimeContext;
  }): Promise<unknown> {
    const candidates = [
      input.handlerKey,
      input.functionName,
      input.toolCode,
    ].filter((item): item is string => Boolean(item));

    for (const key of candidates) {
      const handler = this.handlers.get(key);
      if (handler) {
        return await Promise.resolve(handler(input.args, input.context));
      }
    }

    throw new Error(`Builtin tool not registered: ${input.functionName}`);
  }
}
