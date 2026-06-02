import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReadStream } from 'fs';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { FileService } from '../../file/file.service';
import type { CurrentUser } from '../../../shared/types/current-user.type';
import type { RuntimeContext } from '../../../shared/types/runtime';

type ImageDetail = 'low' | 'high' | 'auto';

interface ImageUnderstandingRuntimeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface OpenAiCompatibleCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface ImageSourceArgs {
  imageUrl?: string;
  fileId?: string;
  detail?: ImageDetail;
}

export interface ImageOcrArgs extends ImageSourceArgs {
  question?: string;
}

export interface ScreenshotAnalysisArgs extends ImageSourceArgs {
  question?: string;
}

export interface ChartAnalysisArgs extends ImageSourceArgs {
  question?: string;
}

export interface SceneDescriptionArgs extends ImageSourceArgs {
  question?: string;
}

@Injectable()
export class ImageUnderstandingClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly fileService: FileService,
  ) {}

  /** 提取图片中的文字内容，适合 OCR 场景。 */
  async extractOcrText(
    args: ImageOcrArgs,
    context?: RuntimeContext,
  ): Promise<unknown> {
    const prompt = [
      '你是 OCR 识别助手。',
      '请尽可能准确提取图片中的所有可见文字。',
      '保留原有层次与换行，避免补充图片中不存在的内容。',
      args.question ? `用户补充问题：${args.question}` : '',
      '请只返回 JSON，字段包括 text、summary、languageHints、answer。',
    ]
      .filter(Boolean)
      .join('\n');

    const content = await this.runVisionTask(args, context, prompt);
    return this.parseStructuredResponse(content, {
      text: content,
      summary: '已完成图片文字识别',
      languageHints: [],
      answer: args.question ? content : '',
    });
  }

  /** 解析截图中的界面结构、代码片段或页面语义。 */
  async analyzeScreenshot(
    args: ScreenshotAnalysisArgs,
    context?: RuntimeContext,
  ): Promise<unknown> {
    const prompt = [
      '你是截图解析助手。',
      '请识别截图中的主要界面、代码、提示信息、关键按钮和可见文本。',
      '如果用户提出问题，请结合截图内容给出直接回答。',
      args.question ? `用户问题：${args.question}` : '',
      '请只返回 JSON，字段包括 summary、detectedText、uiElements、observations、answer。',
    ]
      .filter(Boolean)
      .join('\n');

    const content = await this.runVisionTask(args, context, prompt);
    return this.parseStructuredResponse(content, {
      summary: content,
      detectedText: [],
      uiElements: [],
      observations: [],
      answer: args.question ? content : '',
    });
  }

  /** 识别图表中的轴、系列、趋势与关键数据点。 */
  async analyzeChartData(
    args: ChartAnalysisArgs,
    context?: RuntimeContext,
  ): Promise<unknown> {
    const prompt = [
      '你是图表数据分析助手。',
      '请识别图表类型、标题、坐标轴、图例、关键数据点和趋势。',
      '如果无法读取精确数值，请明确说明是估算值。',
      args.question ? `用户问题：${args.question}` : '',
      '请只返回 JSON，字段包括 chartType、title、axes、series、keyFindings、answer。',
    ]
      .filter(Boolean)
      .join('\n');

    const content = await this.runVisionTask(args, context, prompt);
    return this.parseStructuredResponse(content, {
      chartType: 'unknown',
      title: '',
      axes: [],
      series: [],
      keyFindings: [content],
      answer: args.question ? content : '',
    });
  }

  /** 对图片画面进行整体理解与内容描述。 */
  async describeScene(
    args: SceneDescriptionArgs,
    context?: RuntimeContext,
  ): Promise<unknown> {
    const prompt = [
      '你是画面内容描述助手。',
      '请描述图片中的主体对象、场景、动作、文字信息和可能的用途。',
      '如果用户有提问，请给出基于图片的结论。',
      args.question ? `用户问题：${args.question}` : '',
      '请只返回 JSON，字段包括 summary、objects、actions、textInImage、answer。',
    ]
      .filter(Boolean)
      .join('\n');

    const content = await this.runVisionTask(args, context, prompt);
    return this.parseStructuredResponse(content, {
      summary: content,
      objects: [],
      actions: [],
      textInImage: [],
      answer: args.question ? content : '',
    });
  }

  private async runVisionTask(
    args: ImageSourceArgs,
    context: RuntimeContext | undefined,
    prompt: string,
  ): Promise<string> {
    const imageInput = await this.resolveImageInput(args, context);
    const runtimeConfig = this.getRuntimeConfig();
    const endpoint = `${runtimeConfig.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${runtimeConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: runtimeConfig.model,
          temperature: 0.2,
          max_tokens: 1600,
          messages: [
            {
              role: 'system',
              content:
                '你是严谨的图片理解助手。必须按要求输出，若用户要求 JSON，则只输出 JSON。',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageInput.dataUrl,
                    detail: imageInput.detail,
                  },
                },
              ],
            },
          ],
        }),
      },
      runtimeConfig.timeoutMs,
    );

    const data = (await response.json()) as OpenAiCompatibleCompletionResponse;
    if (!response.ok) {
      throw new BusinessException(
        data.error?.message ?? `图片理解请求失败，状态码 ${response.status}`,
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const content = this.getMessageContent(data);
    if (!content.trim()) {
      throw new BusinessException(
        '图片理解结果为空',
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    }
    return content;
  }

  private async resolveImageInput(
    args: ImageSourceArgs,
    context?: RuntimeContext,
  ): Promise<{ dataUrl: string; detail: ImageDetail }> {
    const detail = this.normalizeDetail(args.detail);
    if (typeof args.imageUrl === 'string' && args.imageUrl.trim()) {
      const remoteImage = await this.fetchRemoteImage(args.imageUrl);
      return {
        dataUrl: remoteImage.dataUrl,
        detail,
      };
    }

    if (typeof args.fileId === 'string' && args.fileId.trim()) {
      if (!context) {
        throw new BusinessException(
          '使用 fileId 解析图片时需要运行时上下文',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }

      const file = await this.fileService.getContent(
        args.fileId,
        this.toCurrentUser(context),
      );
      if (!file.fileAsset.mimeType.startsWith('image/')) {
        throw new BusinessException(
          'fileId 对应的文件不是图片',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }

      const buffer = await this.readStreamToBuffer(file.stream);
      return {
        dataUrl: this.toDataUrl(file.fileAsset.mimeType, buffer),
        detail,
      };
    }

    throw new BusinessException(
      '请提供 imageUrl 或 fileId',
      ErrorCode.BadRequest,
      HttpStatus.BAD_REQUEST,
    );
  }

  private getRuntimeConfig(): ImageUnderstandingRuntimeConfig {
    const apiKey =
      this.configService.get<string>('imageUnderstanding.apiKey')?.trim() ??
      this.configService.get<string>('ai.openai.apiKey')?.trim() ??
      '';
    const baseUrl =
      this.configService.get<string>('imageUnderstanding.baseUrl')?.trim() ??
      this.configService.get<string>('ai.openai.baseUrl')?.trim() ??
      'https://api.openai.com/v1';
    const model =
      this.configService.get<string>('imageUnderstanding.model')?.trim() ??
      'gpt-4o-mini';
    const timeoutMs =
      this.configService.get<number>('imageUnderstanding.timeoutMs') ?? 20000;

    if (!apiKey) {
      throw new BusinessException(
        'IMAGE_UNDERSTANDING_API_KEY 未配置，无法执行图片理解',
        ErrorCode.BusinessError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      apiKey,
      baseUrl,
      model,
      timeoutMs,
    };
  }

  private async fetchRemoteImage(url: string): Promise<{ dataUrl: string }> {
    const parsedUrl = this.normalizeHttpUrl(url);
    const runtimeConfig = this.getRuntimeConfig();
    const response = await this.fetchWithTimeout(
      parsedUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'image/*',
          'User-Agent': 'MiniCozeBot/1.0 (+https://localhost)',
        },
      },
      runtimeConfig.timeoutMs,
    );

    if (!response.ok) {
      throw new BusinessException(
        `图片下载失败，状态码 ${response.status}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const mimeType = response.headers.get('content-type') ?? '';
    if (!mimeType.startsWith('image/')) {
      throw new BusinessException(
        '目标地址不是有效图片资源',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      dataUrl: this.toDataUrl(mimeType, Buffer.from(arrayBuffer)),
    };
  }

  private getMessageContent(data: OpenAiCompatibleCompletionResponse): string {
    const messageContent = data.choices?.[0]?.message?.content;
    if (typeof messageContent === 'string') {
      return messageContent;
    }

    if (Array.isArray(messageContent)) {
      return messageContent
        .filter(
          (item): item is { type?: string; text?: string } =>
            !!item && typeof item === 'object' && !Array.isArray(item),
        )
        .map((item) => (item.type === 'text' ? (item.text ?? '') : ''))
        .join('\n')
        .trim();
    }

    return '';
  }

  private parseStructuredResponse(
    raw: string,
    fallback: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized = raw.trim();
    const matched =
      normalized.match(/```json\s*([\s\S]*?)\s*```/i) ??
      normalized.match(/```[\s\S]*?\n([\s\S]*?)\s*```/i);
    const jsonText = matched?.[1]?.trim() ?? normalized;

    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {
        ...fallback,
        raw,
      };
    }

    return {
      ...fallback,
      raw,
    };
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
        `图片理解网络请求失败: ${message}`,
        ErrorCode.BusinessError,
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async readStreamToBuffer(stream: ReadStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      const normalizedChunk = Buffer.isBuffer(chunk)
        ? Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
        : Buffer.from(typeof chunk === 'string' ? chunk : String(chunk));
      chunks.push(normalizedChunk);
    }
    return Buffer.concat(chunks);
  }

  private toDataUrl(mimeType: string, buffer: Buffer): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  private toCurrentUser(context: RuntimeContext): CurrentUser {
    return {
      id: context.userId,
      email: `${context.userId}@runtime.local`,
      username: 'runtime-user',
    };
  }

  private normalizeDetail(detail: unknown): ImageDetail {
    return detail === 'low' || detail === 'high' || detail === 'auto'
      ? detail
      : 'high';
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
        `图片地址不合法: ${error instanceof Error ? error.message : '无法解析 URL'}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
