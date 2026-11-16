import type { Response } from 'express';
import type { RuntimeEvent } from '../../shared/types/agent';

export async function writeRuntimeEventStream(
  res: Response,
  events: AsyncIterable<RuntimeEvent>,
  options?: {
    /** 捕获 run.created 事件中的 runId，供调用方在连接断开时定位运行。 */
    onRunCreated?: (runId: string) => void;
  },
): Promise<void> {
  try {
    const iterator = events[Symbol.asyncIterator]();
    const first = await iterator.next();

    if (first.done) {
      res.status(204).end();
      return;
    }

    if (first.value.type === 'run.created') {
      options?.onRunCreated?.(first.value.runId);
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: ${first.value.type}\n`);
    res.write(`data: ${JSON.stringify(first.value)}\n\n`);

    for (;;) {
      const next = await iterator.next();
      if (next.done) {
        break;
      }

      if (next.value.type === 'run.created') {
        options?.onRunCreated?.(next.value.runId);
      }

      res.write(`event: ${next.value.type}\n`);
      res.write(`data: ${JSON.stringify(next.value)}\n\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!res.headersSent) {
      res.status(500).json({
        code: 500,
        message,
        data: null,
      });
      return;
    }

    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ message })}\n\n`);
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
}
