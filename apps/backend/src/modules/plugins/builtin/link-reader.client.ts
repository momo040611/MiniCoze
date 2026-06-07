import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';

interface LinkReaderRuntimeConfig {
  timeoutMs: number;
  maxChars: number;
}

interface LinkReaderFetchArgs {
  url: string;
  maxChars?: number;
}

interface LinkDocument {
  url: string;
  finalUrl: string;
  hostname: string;
  contentType: string;
  title: string;
  description: string;
  siteName: string;
  author: string | null;
  publishDate: string | null;
  html: string;
  articleText: string;
  fullText: string;
  headings: string[];
  sourceType: 'wechat' | 'blog' | 'webpage';
}

@Injectable()
export class LinkReaderClient {
  constructor(private readonly configService: ConfigService) {}

  /** 抓取 URL 全文，尽量保留页面原始可读文本。 */
  async fetchFullContent(args: LinkReaderFetchArgs): Promise<unknown> {
    const document = await this.fetchDocument(args.url);
    const maxChars = this.normalizeMaxChars(args.maxChars);
    const content = this.truncate(
      document.articleText || document.fullText,
      maxChars,
    );

    return {
      url: document.url,
      finalUrl: document.finalUrl,
      title: document.title,
      description: document.description || null,
      siteName: document.siteName || null,
      sourceType: document.sourceType,
      contentType: document.contentType,
      headings: document.headings,
      content,
      wordCount: this.countWords(content),
    };
  }

  /** 清洗网页内容，去除常见导航、版权和噪音文本。 */
  async cleanWebContent(args: LinkReaderFetchArgs): Promise<unknown> {
    const document = await this.fetchDocument(args.url);
    const maxChars = this.normalizeMaxChars(args.maxChars);
    const cleanedContent = this.truncate(
      this.removeBoilerplate(document.articleText || document.fullText),
      maxChars,
    );
    const paragraphs = cleanedContent
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20);

    return {
      url: document.url,
      finalUrl: document.finalUrl,
      title: document.title,
      cleanedContent,
      paragraphs,
      headings: document.headings,
      wordCount: this.countWords(cleanedContent),
    };
  }

  /** 解析公众号或博客文章结构，提取作者、发布时间与正文。 */
  async parseArticle(args: LinkReaderFetchArgs): Promise<unknown> {
    const document = await this.fetchDocument(args.url);
    const maxChars = this.normalizeMaxChars(args.maxChars);
    const content = this.truncate(
      this.removeBoilerplate(document.articleText || document.fullText),
      maxChars,
    );

    return {
      url: document.url,
      finalUrl: document.finalUrl,
      sourceType: document.sourceType,
      title: document.title,
      description: document.description || null,
      siteName: document.siteName || null,
      author: document.author,
      publishDate: document.publishDate,
      headings: document.headings,
      content,
      excerpt: this.truncate(content, 280),
      isWechatArticle: document.sourceType === 'wechat',
      isBlogLike: document.sourceType === 'blog',
    };
  }

  private async fetchDocument(url: string): Promise<LinkDocument> {
    const normalizedUrl = this.normalizeHttpUrl(url);
    const runtimeConfig = this.getRuntimeConfig();
    const response = await this.fetchWithTimeout(
      normalizedUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain',
          'User-Agent': 'MiniCozeBot/1.0 (+https://localhost)',
        },
      },
      runtimeConfig.timeoutMs,
    );

    if (!response.ok) {
      throw new BusinessException(
        `链接抓取失败，状态码 ${response.status}`,
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const contentType = response.headers.get('content-type') ?? 'text/html';
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml') &&
      !contentType.includes('text/plain')
    ) {
      throw new BusinessException(
        `暂不支持解析该链接内容类型: ${contentType}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const finalUrl = response.url || normalizedUrl;
    const rawText = await response.text();
    const parsed = new URL(finalUrl);

    if (contentType.includes('text/plain')) {
      const normalizedText = this.normalizeLineBreaks(rawText);
      return {
        url: normalizedUrl,
        finalUrl,
        hostname: parsed.hostname,
        contentType,
        title: this.inferPlainTextTitle(parsed.hostname, normalizedText),
        description: '',
        siteName: parsed.hostname,
        author: null,
        publishDate: null,
        html: '',
        articleText: normalizedText,
        fullText: normalizedText,
        headings: [],
        sourceType: this.detectSourceType(parsed.hostname),
      };
    }

    const articleFragment = this.extractArticleFragment(rawText);
    const articleText = this.extractTextContent(articleFragment);
    const fullText = this.extractTextContent(rawText);
    const headings = this.extractHeadings(articleFragment || rawText);

    return {
      url: normalizedUrl,
      finalUrl,
      hostname: parsed.hostname,
      contentType,
      title: this.extractTitle(rawText),
      description: this.extractMeta(rawText, [
        'description',
        'og:description',
        'twitter:description',
      ]),
      siteName: this.extractMeta(rawText, ['og:site_name']) || parsed.hostname,
      author: this.extractAuthor(rawText),
      publishDate: this.extractPublishDate(rawText),
      html: rawText,
      articleText,
      fullText,
      headings,
      sourceType: this.detectSourceType(parsed.hostname),
    };
  }

  private getRuntimeConfig(): LinkReaderRuntimeConfig {
    return {
      timeoutMs:
        this.configService.get<number>('linkReader.timeoutMs') ?? 15000,
      maxChars: this.configService.get<number>('linkReader.maxChars') ?? 20000,
    };
  }

  private normalizeMaxChars(value: number | undefined): number {
    const runtimeConfig = this.getRuntimeConfig();
    const normalized = value ?? runtimeConfig.maxChars;
    if (normalized < 500) {
      return 500;
    }
    if (normalized > runtimeConfig.maxChars) {
      return runtimeConfig.maxChars;
    }
    return normalized;
  }

  private detectSourceType(hostname: string): LinkDocument['sourceType'] {
    if (hostname.includes('mp.weixin.qq.com')) {
      return 'wechat';
    }
    if (
      hostname.includes('juejin.cn') ||
      hostname.includes('csdn.net') ||
      hostname.includes('cnblogs.com') ||
      hostname.includes('medium.com') ||
      hostname.includes('substack.com') ||
      hostname.includes('dev.to') ||
      hostname.includes('zhihu.com')
    ) {
      return 'blog';
    }
    return 'webpage';
  }

  private extractArticleFragment(html: string): string {
    const candidates: string[] = [];
    const patterns = [
      /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
      /<main\b[^>]*>([\s\S]*?)<\/main>/gi,
      /<div\b[^>]*(?:id|class)=["'][^"']*(?:js_content|rich_media_content|rich_media_area_primary_inner|post-content|entry-content|article-content|markdown-body|theme-doc-markdown|doc-content|content-body|blog-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      /<section\b[^>]*(?:id|class)=["'][^"']*(?:article|content|post)[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
    ];

    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const fragment = match[1]?.trim();
        if (fragment) {
          candidates.push(fragment);
        }
      }
    }

    if (!candidates.length) {
      const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
      return bodyMatch?.[1] ?? html;
    }

    return candidates.sort((left, right) => right.length - left.length)[0];
  }

  private extractTextContent(html: string): string {
    const withoutNoise = html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '\n')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '\n')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '\n')
      .replace(/<form[\s\S]*?<\/form>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(
        /<\/(p|div|section|article|main|header|h1|h2|h3|h4|h5|h6|li|tr)>/gi,
        '\n',
      )
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<td\b[^>]*>/gi, ' ')
      .replace(/<th\b[^>]*>/gi, ' ');

    const text = withoutNoise.replace(/<[^>]+>/g, ' ');
    return this.normalizeLineBreaks(this.decodeHtmlEntities(text));
  }

  private extractHeadings(html: string): string[] {
    const headingMatches = html.matchAll(
      /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi,
    );
    const headings = Array.from(headingMatches)
      .map((match) => this.cleanInlineText(match[1] ?? ''))
      .filter(Boolean);
    return headings.slice(0, 20);
  }

  private extractTitle(html: string): string {
    const titleFromMeta = this.extractMeta(html, ['og:title', 'twitter:title']);
    if (titleFromMeta) {
      return titleFromMeta;
    }
    const matched = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return this.cleanInlineText(matched?.[1] ?? '');
  }

  private extractMeta(html: string, names: string[]): string {
    for (const name of names) {
      const metaPatterns = [
        new RegExp(
          `<meta[^>]+(?:name|property)=["']${this.escapeRegExp(name)}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
          'i',
        ),
        new RegExp(
          `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+(?:name|property)=["']${this.escapeRegExp(name)}["'][^>]*>`,
          'i',
        ),
      ];

      for (const pattern of metaPatterns) {
        const matched = html.match(pattern);
        const value = this.cleanInlineText(matched?.[1] ?? '');
        if (value) {
          return value;
        }
      }
    }
    return '';
  }

  private extractAuthor(html: string): string | null {
    const metaAuthor = this.extractMeta(html, ['author', 'article:author']);
    if (metaAuthor) {
      return metaAuthor;
    }

    const wechatAuthor = html.match(
      /<[^>]+id=["']js_name["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    );
    const timeAuthor = html.match(
      /<[^>]+class=["'][^"']*(?:author|byline|post-author)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    );
    const author = this.cleanInlineText(
      wechatAuthor?.[1] ?? timeAuthor?.[1] ?? '',
    );
    return author || null;
  }

  private extractPublishDate(html: string): string | null {
    const metaDate = this.extractMeta(html, [
      'article:published_time',
      'og:published_time',
      'publishdate',
    ]);
    if (metaDate) {
      return metaDate;
    }

    const timeMatch = html.match(
      /<time\b[^>]*datetime=["']([\s\S]*?)["'][^>]*>/i,
    );
    if (timeMatch?.[1]) {
      return this.cleanInlineText(timeMatch[1]);
    }

    const wechatTimestampMatch = html.match(
      /var\s+ct\s*=\s*["']?(\d{10})["']?/i,
    );
    if (wechatTimestampMatch?.[1]) {
      const timestamp = Number(wechatTimestampMatch[1]);
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp * 1000).toISOString();
      }
    }

    return null;
  }

  private inferPlainTextTitle(hostname: string, text: string): string {
    const firstLine = text
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    return firstLine || hostname;
  }

  private removeBoilerplate(text: string): string {
    const boilerplatePatterns = [
      /^(上一篇|下一篇|相关阅读|相关文章|推荐阅读)[:：]?$/i,
      /^(登录|注册|收藏|点赞|转发|分享|评论)[:：]?$/i,
      /^(版权所有|版权声明|免责声明|未经许可不得转载)/i,
      /^(微信扫一扫|扫描二维码|长按识别二维码)/i,
      /^(menu|navigation|sign in|log in|cookie preferences)$/i,
    ];

    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 1)
      .filter(
        (line) => !boilerplatePatterns.some((pattern) => pattern.test(line)),
      )
      .join('\n');
  }

  private countWords(text: string): number {
    const normalized = text.trim();
    if (!normalized) {
      return 0;
    }
    return normalized.split(/\s+/).length;
  }

  private cleanInlineText(value: string): string {
    return this.decodeHtmlEntities(value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeLineBreaks(value: string): string {
    return value
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
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

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private truncate(value: string, maxChars: number): string {
    if (!value) {
      return '';
    }
    return value.length > maxChars
      ? `${value.slice(0, maxChars).trim()}...`
      : value;
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
        `链接地址不合法: ${error instanceof Error ? error.message : '无法解析 URL'}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
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
        `链接读取网络请求失败: ${message}`,
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
