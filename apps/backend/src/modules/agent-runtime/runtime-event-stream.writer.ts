import type { Response } from 'express';
import type { RuntimeEvent } from '../../shared/types/agent';

export async function writeRuntimeEventStream(
  res: Response,
  events: AsyncIterable<RuntimeEvent>,
): Promise<void> {
  try {
    const iterator = events[Symbol.asyncIterator]();
    const first = await iterator.next();

    if (first.done) {
      res.status(204).end();
      return;
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
