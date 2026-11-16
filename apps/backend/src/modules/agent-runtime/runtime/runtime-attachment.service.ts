import { HttpStatus, Injectable } from '@nestjs/common';
import { FilePurpose, type FileAsset } from '@prisma/client';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';
import type {
  ChatMessage,
  RuntimeAttachment,
} from '../../../shared/types/agent';
import type { CurrentUser } from '../../../shared/types/current-user.type';
import type { RuntimeContext } from '../../../shared/types/runtime';
import { FileService } from '../../file/file.service';
import { ImageUnderstandingClient } from '../../plugins/builtin/image-understanding.client';
import { DocumentParserService } from '../../knowledge/parsing/document-parser.service';

@Injectable()
export class RuntimeAttachmentService {
  private readonly maxTextChars = 12000;
  private readonly textMimeTypes = new Set([
    'text/plain',
    'text/markdown',
    'text/x-markdown',
  ]);
  private readonly textExtensions = new Set(['.txt', '.md']);
  // 可解析为文本的文档附件扩展名（复用知识库解析器）。
  private readonly documentExtensions = new Set(['pdf', 'docx', 'xlsx', 'xls', 'csv']);

  constructor(
    private readonly fileService: FileService,
    private readonly imageUnderstandingClient: ImageUnderstandingClient,
    private readonly documentParser: DocumentParserService,
  ) {}

  async buildAttachmentSystemMessage(input: {
    attachments?: RuntimeAttachment[];
    question: string;
    context: RuntimeContext;
  }): Promise<ChatMessage | null> {
    const attachments = input.attachments?.filter((item) => item.fileId);
    if (!attachments?.length) {
      return null;
    }

    const sections: string[] = [];
    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      try {
        sections.push(
          await this.buildAttachmentSection({
            index: index + 1,
            attachment,
            question: input.question,
            context: input.context,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BusinessException(
          `读取附件失败（${attachment.name ?? attachment.fileId}）：${message}`,
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return {
      role: 'system',
      content: [
        '用户本轮上传了附件。以下内容来自后端真实读取或图片理解结果，请在回答时优先结合这些内容。',
        ...sections,
      ].join('\n\n'),
    };
  }

  private async buildAttachmentSection(input: {
    index: number;
    attachment: RuntimeAttachment;
    question: string;
    context: RuntimeContext;
  }): Promise<string> {
    const fileAsset = await this.fileService.getReadyFileForUser(
      input.attachment.fileId,
      this.toCurrentUser(input.context),
    );

    if (fileAsset.purpose !== FilePurpose.CHAT_ATTACHMENT) {
      throw new BusinessException(
        '文件用途不是聊天附件',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const title = `附件 ${input.index}：${fileAsset.originalName} (fileId: ${fileAsset.id}, ${fileAsset.mimeType}, ${fileAsset.size} bytes)`;

    if (fileAsset.mimeType.startsWith('image/')) {
      const result = await this.imageUnderstandingClient.describeScene(
        {
          fileId: fileAsset.id,
          detail: 'high',
          question: input.question,
        },
        input.context,
      );

      return [
        title,
        '(系统已自动完成图片理解，以下结果可直接使用。如需对同一图片执行 OCR、截图解析或图表分析，可引用上方的 fileId 调用对应工具，不需要重复分析。)\n图片理解结果：',
        this.stringifyResult(result),
      ].join('\n');
    }

    if (this.isTextFile(fileAsset)) {
      const buffer = await this.fileService.getFileBufferForInternal(
        fileAsset.id,
      );
      const content = buffer.toString('utf8');
      return [title, '文本内容：', this.truncate(content)].join('\n');
    }

    // PDF / docx / xlsx 等文档附件：复用知识库解析器抽文本后注入。
    const ext = fileAsset.extension?.toLowerCase().replace(/^\./, '') ?? '';
    if (this.documentExtensions.has(ext)) {
      const buffer = await this.fileService.getFileBufferForInternal(
        fileAsset.id,
      );
      const parsed = await this.documentParser.parse(buffer, ext);
      return [
        title,
        `(系统已自动解析为文本${parsed.parser === 'pdf' ? '，含分页标记' : ''})`,
        '文本内容：',
        this.truncate(parsed.text),
      ].join('\n');
    }

    throw new BusinessException(
      '附件仅支持图片、txt/md 文本与 pdf/docx/xlsx 文档',
      ErrorCode.BadRequest,
      HttpStatus.BAD_REQUEST,
    );
  }

  private truncate(content: string): string {
    if (content.length <= this.maxTextChars) {
      return content;
    }

    return `${content.slice(0, this.maxTextChars)}\n[内容已截断，原文长度 ${content.length} 字符]`;
  }

  private isTextFile(fileAsset: FileAsset): boolean {
    return (
      this.textMimeTypes.has(fileAsset.mimeType) ||
      (fileAsset.extension
        ? this.textExtensions.has(fileAsset.extension)
        : false)
    );
  }

  private stringifyResult(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value, null, 2);
  }

  private toCurrentUser(context: RuntimeContext): CurrentUser {
    return {
      id: context.userId,
      email: `${context.userId}@runtime.local`,
      username: 'runtime-user',
    };
  }
}
