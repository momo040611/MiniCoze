import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';

/**
 * 知识库文档解析器：把上传的文件统一解析为纯文本，供后续切分/embedding 使用。
 * 支持：txt/md（直读）、pdf（pdf-parse v2）、docx（mammoth）、xlsx/xls/csv（xlsx 按表转文本）。
 */
export interface ParsedDocument {
  text: string;
  /** 解析方式标记，用于附件注入时的提示与日志排查。 */
  parser: 'plain-text' | 'pdf' | 'docx' | 'spreadsheet';
}

// pdf-parse v2 为纯 ESM 包且未捆绑类型，这里声明用到的最小 API 面。
interface PdfPageText {
  text?: string;
}

interface PdfParserHandle {
  getText(): Promise<{ pages?: PdfPageText[] }>;
  destroy(): Promise<void>;
}

interface MammothModule {
  extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>;
}

interface XlsxModule {
  read(data: Buffer, options: { type: 'buffer' }): {
    SheetNames: string[];
    Sheets: Record<string, Record<string, unknown>>;
  };
  utils: {
    sheet_to_csv(sheet: Record<string, unknown>, options?: { blankrows?: boolean }): string;
  };
}

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown']);
const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv']);
// PDF 页数上限：超过直接拒绝，避免超大文档阻塞同步流水线。
export const MAX_PDF_PAGES = 100;

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  async parse(buffer: Buffer, extension: string): Promise<ParsedDocument> {
    const ext = extension.toLowerCase();

    if (TEXT_EXTENSIONS.has(ext)) {
      return { text: buffer.toString('utf8'), parser: 'plain-text' };
    }

    if (ext === 'pdf') {
      return { text: await this.parsePdf(buffer), parser: 'pdf' };
    }

    if (ext === 'docx') {
      return { text: await this.parseDocx(buffer), parser: 'docx' };
    }

    if (SPREADSHEET_EXTENSIONS.has(ext)) {
      return { text: this.parseSpreadsheet(buffer), parser: 'spreadsheet' };
    }

    throw new BusinessException(
      `暂不支持解析 .${ext} 文档，请转换为 txt / md / pdf / docx / xlsx 后上传`,
      ErrorCode.KnowledgeFileTypeUnsupported,
      HttpStatus.BAD_REQUEST,
    );
  }

  /** .doc（旧版二进制 Word）与 .ppt 明确不支持，给出可操作的提示。 */
  static isLegacyUnsupported(extension: string): boolean {
    return ['doc', 'ppt', 'pptx'].includes(extension.toLowerCase());
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      // pdf-parse v2 是纯 ESM 包；Node 22+ 的 require(esm) 可直接加载，
      // 同时兼容 Jest CJS 环境（动态 import 在 Jest 下需要实验开关）。
      const { PDFParse } = require('pdf-parse') as {
        PDFParse: new (options: { data: Uint8Array }) => PdfParserHandle;
      };
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        const pages = result.pages ?? [];
        if (pages.length > MAX_PDF_PAGES) {
          throw new BusinessException(
            `PDF 页数超过上限（${pages.length} > ${MAX_PDF_PAGES} 页）`,
            ErrorCode.KnowledgeFileTooLarge,
            HttpStatus.BAD_REQUEST,
          );
        }

        return pages
          .map((page, index) => {
            const content = (page.text ?? '').trim();
            return content ? `【第 ${index + 1} 页】\n${content}` : '';
          })
          .filter(Boolean)
          .join('\n\n');
      } finally {
        await parser.destroy();
      }
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }

      this.logger.warn(
        `PDF 解析失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BusinessException(
        'PDF 解析失败，文件可能损坏或为扫描件（不支持 OCR）',
        ErrorCode.KnowledgeFileTypeUnsupported,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth') as MammothModule;
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      this.logger.warn(
        `docx 解析失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BusinessException(
        'docx 解析失败，文件可能损坏',
        ErrorCode.KnowledgeFileTypeUnsupported,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private parseSpreadsheet(buffer: Buffer): string {
    try {
      const XLSX = require('xlsx') as XlsxModule;
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      return workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        // 每张表转成 CSV 文本，保持行列语义，切分后检索友好。
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        return `【工作表：${sheetName}】\n${csv}`;
      })
        .filter((block) => block.trim().length > 0)
        .join('\n\n');
    } catch (error) {
      this.logger.warn(
        `表格解析失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BusinessException(
        '表格解析失败，文件可能损坏',
        ErrorCode.KnowledgeFileTypeUnsupported,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
