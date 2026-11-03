import {
  ArgumentsHost,
  ConflictException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../http-exception.filter';
import { ErrorCode } from '../../constants/error-code';

function createHost() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    headersSent: false,
    writableEnded: false,
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('HttpExceptionFilter：状态码 → 业务码映射', () => {
  const filter = new HttpExceptionFilter();

  it('400 → BadRequest', () => {
    const { host, res } = createHost();
    filter.catch(new HttpException('bad', HttpStatus.BAD_REQUEST), host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe(ErrorCode.BadRequest);
  });

  it('409 → Conflict', () => {
    const { host, res } = createHost();
    filter.catch(new ConflictException('dup'), host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe(ErrorCode.Conflict);
  });

  it('422 → UnprocessableEntity', () => {
    const { host, res } = createHost();
    filter.catch(new UnprocessableEntityException('语义不合法'), host);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json.mock.calls[0][0].code).toBe(ErrorCode.UnprocessableEntity);
  });

  it('429 → TooManyRequests', () => {
    const { host, res } = createHost();
    filter.catch(new HttpException('slow down', HttpStatus.TOO_MANY_REQUESTS), host);
    expect(res.json.mock.calls[0][0].code).toBe(ErrorCode.TooManyRequests);
  });

  it('503 → ServiceUnavailable', () => {
    const { host, res } = createHost();
    filter.catch(new HttpException('down', HttpStatus.SERVICE_UNAVAILABLE), host);
    expect(res.json.mock.calls[0][0].code).toBe(ErrorCode.ServiceUnavailable);
  });
});