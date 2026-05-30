import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-code';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class HttpPluginExecutor {
  supports(type: string): boolean {
    return type === 'HTTP';
  }

  async execute(): Promise<never> {
    throw new BusinessException(
      'HTTP 插件执行器尚未实现',
      ErrorCode.BusinessError,
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
