import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { ErrorCode } from '../constants/error-code';
import { BusinessException } from '../exceptions/business.exception';

interface ExceptionResponseBody {
  code?: number;
  message?: string | string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const { status, code, message } = this.normalizeException(exception);

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (response.headersSent || response.writableEnded) {
      this.logger.warn(
        `Skip error response because headers were already sent: ${message}`,
      );
      return;
    }

    response.status(status).json({
      code,
      message,
      data: null,
    });
  }

  private normalizeException(exception: unknown) {
    if (exception instanceof BusinessException) {
      return {
        status: exception.getStatus(),
        code: exception.getErrorCode(),
        message: exception.message,
      };
    }

    // multer 文件大小超限 / 字段错误等映射为业务错误码。
    if (exception instanceof MulterError) {
      if (exception.code === 'LIMIT_FILE_SIZE') {
        return {
          status: HttpStatus.PAYLOAD_TOO_LARGE,
          code: ErrorCode.KnowledgeFileTooLarge,
          message: 'uploaded file exceeds size limit',
        };
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        code: ErrorCode.BadRequest,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const body =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as ExceptionResponseBody)
          : undefined;
      const message = this.formatMessage(body?.message ?? exception.message);

      return {
        status,
        code: this.getCodeByStatus(status),
        message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalServerError,
      message: 'Internal server error',
    };
  }

  private formatMessage(message: string | string[]) {
    return Array.isArray(message) ? message.join('; ') : message;
  }

  private getCodeByStatus(status: number) {
    const codeMap: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.BadRequest,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.Unauthorized,
      [HttpStatus.FORBIDDEN]: ErrorCode.Forbidden,
      [HttpStatus.NOT_FOUND]: ErrorCode.NotFound,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.InternalServerError,
    };

    return codeMap[status] ?? ErrorCode.BusinessError;
  }
}
