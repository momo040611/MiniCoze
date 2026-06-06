import type { Response } from 'express';
import type { RuntimeEvent } from '../../shared/types/agent';

export async function writeRuntimeEventStream(
  res: Response,
  events: AsyncIterable<RuntimeEvent>,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    for await (const event of events) {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } finally {
    res.end();
  }
}
