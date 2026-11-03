import type { Response } from 'express';

import { WorkflowStreamWriter } from '../workflow-stream.writer';

function createFakeResponse() {
  const chunks: string[] = [];

  const res = {
    headersSent: false,
    writableEnded: false,
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => {
      chunks.push(chunk);
      return true;
    }),
    end: jest.fn(() => {
      res.writableEnded = true;
    }),
  };

  return { res: res as unknown as Response, chunks };
}

describe('WorkflowStreamWriter', () => {
  it('正常事件写出 SSE 帧，结束后关闭连接', async () => {
    const { res, chunks } = createFakeResponse();
    const writer = new WorkflowStreamWriter(res);

    await writer.pipe(async (send) => {
      send({ type: 'run.created', runId: 'r1' } as never);
    });

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream; charset=utf-8',
    );
    expect(chunks[0]).toBe('event: run.created\n');
    expect(chunks[1]).toBe('data: {"type":"run.created","runId":"r1"}\n\n');
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('执行抛错时写 error 帧，且仍然关闭连接', async () => {
    const { res, chunks } = createFakeResponse();
    const writer = new WorkflowStreamWriter(res);

    await writer.pipe(async () => {
      throw new Error('工作流不存在');
    });

    expect(chunks.join('')).toContain('event: error\n');
    expect(chunks.join('')).toContain('"message":"工作流不存在"');
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('关闭之后不再写出', async () => {
    const { res, chunks } = createFakeResponse();
    const writer = new WorkflowStreamWriter(res);
    let leaked: ((event: never) => void) | undefined;

    await writer.pipe(async (send) => {
      leaked = send as (event: never) => void;
    });

    const before = chunks.length;
    leaked!({ type: 'late' } as never);

    expect(chunks.length).toBe(before);
  });
});