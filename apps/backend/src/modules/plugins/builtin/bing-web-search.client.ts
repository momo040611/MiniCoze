import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';

interface BingApiErrorResponse {
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
}

interface BingApiWebPageItem {
  name?: string;
  url?: string;
  displayUrl?: string;
  snippet?: string;
  siteName?: string;
  language?: string;
  dateLastCrawled?: string;
  isFamilyFriendly?: boolean;
}

interface BingApiSearchResponse {
  queryContext?: {
    originalQuery?: string;
  };
  webPages?: {
    totalEstimatedMatches?: number;
    value?: BingApiWebPageItem[];
  };
}

interface BingSearchRuntimeConfig {
  apiKey: string;
  endpoint: string;
  timeoutMs: number;
}

type BingFreshness = 'Day' | 'Week' | 'Month';
type BingSafeSearch = 'Off' | 'Moderate' | 'Strict';

export interface BingSearchWebpagesArgs {
  query: string;
  count?: number;
  offset?: number;
  mkt?: string;
  freshness?: BingFreshness;
  safeSearch?: BingSafeSearch;
}

export interface BingPagedSearchArgs {
  query: string;
  page?: number;
  pageSize?: number;
  mkt?: string;
  freshness?: BingFreshness;
  safeSearch?: BingSafeSearch;
}

export interface BingPageSummaryArgs {
  url: string;
  maxChars?: number;
}

@Injectable()
export class BingWebSearchClient {
  constructor(private readonly configService: ConfigService) {}

  /** 执行基础网页检索并返回结构化结果。 */
  async searchWebpages(args: BingSearchWebpagesArgs): Promise<unknown> {
    const count = this.normalizeInteger(args.count, 10, 1, 50);
    const offset = this.normalizeInteger(args.offset, 0, 0, 1000);
    const data = await this.requestSearch({
      query: args.query,
      count,
      offset,
      mkt: args.mkt,
      freshness: args.freshness,
      safeSearch: args.safeSearch,
    });

    const items = data.webPages?.value ?? [];
    const total = data.webPages?.totalEstimatedMatches ?? items.length;

    return {
      query: data.queryContext?.originalQuery ?? args.query,
      count,
      offset,
      totalEstimatedMatches: total,
      results: items.map((item) => ({
        title: item.name ?? '',
        url: item.url ?? '',
        displayUrl: item.displayUrl ?? null,
        snippet: item.snippet ?? '',
        siteName: item.siteName ?? null,
        language: item.language ?? null,
        dateLastCrawled: item.dateLastCrawled ?? null,
        isFamilyFriendly: item.isFamilyFriendly ?? null,
      })),
    };
  }

  /** 基于页码执行分页检索，便于 Agent 续翻结果页。 */
  async pagedSearch(args: BingPagedSearchArgs): Promise<unknown> {
    const page = this.normalizeInteger(args.page, 1, 1, 100);
    const pageSize = this.normalizeInteger(args.pageSize, 10, 1, 50);
    const offset = (page - 1) * pageSize;
    const data = (await this.searchWebpages({
      query: args.query,
      count: pageSize,
      offset,
      mkt: args.mkt,
      freshness: args.freshness,
      safeSearch: args.safeSearch,
    })) as {
      query: string;
      count: number;
      offset: number;
      totalEstimatedMatches: number;
      results: unknown[];
    };

    return {
      ...data,
      page,
      pageSize,
      hasMore: offset + pageSize < data.totalEstimatedMatches,
    };
  }

  /** 抓取目标网页并提取标题、描述与正文预览，作为页面摘要。 */
  async summarizePage(args: BingPageSummaryArgs): Promise<unknown> {
    const url = this.normalizeHttpUrl(args.url);
    const maxChars = this.normalizeInteger(args.maxChars, 1200, 200, 5000);
    const runtimeConfig = this.getRuntimeConfig();
    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'MiniCozeBot/1.0 (+https://localhost)',
        },
      },
      runtimeConfig.timeoutMs,
    );

    const html = await response.text();
    const title = this.extractTitle(html);
    const description = this.extractMetaDescription(html);
    const content = this.extractTextContent(html);
    const summarySource = description || content;

    return {
      url,
      title: title || null,
      description: description || null,
      summary: this.truncate(summarySource, maxChars),
      contentPreview: this.truncate(content, maxChars),
    };
  }

  private getRuntimeConfig(): BingSearchRuntimeConfig {
    const apiKey = this.configService.get<string>('search.bing.apiKey')?.trim();
    const endpoint =
      this.configService.get<string>('search.bing.endpoint')?.trim() ??
      'https://api.bing.microsoft.com/v7.0/search';
    const timeoutMs =
      this.configService.get<number>('search.bing.timeoutMs') ?? 10000;

    if (!apiKey) {
      throw new BusinessException(
        'BING_SEARCH_API_KEY 未配置，无法执行网页检索',
        ErrorCode.BusinessError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      apiKey,
      endpoint,
      timeoutMs,
    };
  }

  private async requestSearch(args: BingSearchWebpagesArgs) {
    const runtimeConfig = this.getRuntimeConfig();
    const url = new URL(runtimeConfig.endpoint);
    url.searchParams.set('q', args.query);
    url.searchParams.set('count', String(args.count ?? 10));
    url.searchParams.set('offset', String(args.offset ?? 0));
    url.searchParams.set('responseFilter', 'Webpages');
    url.searchParams.set('textFormat', 'Raw');

    if (args.mkt) {
      url.searchParams.set('mkt', args.mkt);
    }
    if (args.freshness) {
      url.searchParams.set('freshness', args.freshness);
    }
    if (args.safeSearch) {
      url.searchParams.set('safeSearch', args.safeSearch);
    }

    const response = await this.fetchWithTimeout(
      url.toString(),
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Ocp-Apim-Subscription-Key': runtimeConfig.apiKey,
        },
      },
      runtimeConfig.timeoutMs,
    );

    const data: unknown = await response.json();

    if (!response.ok) {
      const errorMessage = this.getBingErrorMessage(data, response.status);
      throw new BusinessException(
        errorMessage,
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    }

    return data as BingApiSearchResponse;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知网络错误';
      throw new BusinessException(
        `网页请求失败: ${message}`,
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizeInteger(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const normalized = value ?? fallback;
    if (normalized < min) {
      return min;
    }
    if (normalized > max) {
      return max;
    }
    return normalized;
  }

  private normalizeHttpUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('仅支持 http/https 协议');
      }
      return parsed.toString();
    } catch (error) {
      throw new BusinessException(
        `网页地址不合法: ${error instanceof Error ? error.message : '无法解析 URL'}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private extractTitle(html: string): string {
    const matched = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return this.cleanText(matched?.[1] ?? '');
  }

  private extractMetaDescription(html: string): string {
    const nameMatched = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    );
    const propertyMatched = html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    );
    return this.cleanText(nameMatched?.[1] ?? propertyMatched?.[1] ?? '');
  }

  private extractTextContent(html: string): string {
    const withoutScript = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
    const text = withoutScript.replace(/<[^>]+>/g, ' ');
    return this.cleanText(text);
  }

  private cleanText(value: string): string {
    return this.decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCharCode(Number(code)),
      )
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
        String.fromCharCode(parseInt(code, 16)),
      );
  }

  private truncate(value: string, maxChars: number): string {
    if (!value) {
      return '';
    }
    return value.length > maxChars
      ? `${value.slice(0, maxChars).trim()}...`
      : value;
  }

  private getBingErrorMessage(data: unknown, status: number): string {
    if (this.isBingApiErrorResponse(data)) {
      const firstError = data.errors?.[0];
      if (
        typeof firstError?.message === 'string' &&
        firstError.message.trim()
      ) {
        return firstError.message;
      }
    }
    return `Bing 搜索请求失败，状态码 ${status}`;
  }

  private isBingApiErrorResponse(
    value: unknown,
  ): value is BingApiErrorResponse {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const candidate = value as { errors?: unknown };
    return (
      candidate.errors === undefined ||
      (Array.isArray(candidate.errors) &&
        candidate.errors.every(
          (item) => item && typeof item === 'object' && !Array.isArray(item),
        ))
    );
  }
}
