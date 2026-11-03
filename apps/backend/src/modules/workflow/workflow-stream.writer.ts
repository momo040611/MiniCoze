import type { Response } from 'express';

import type { WorkflowStreamEvent } from './internal/execute/workflow-run-event';

/**
 * SSE 写出层：只负责「把事件变成字节写进连接」。
 *
 * 刻意不做的事：
 * - 不判断该发什么事件（业务决定）
 * - 不关心 run 成功还是失败（只关心连接怎么开、怎么写、怎么关）
 */
export class WorkflowStreamWriter {
  private closed = false;

  constructor(private readonly res: Response) {}

  /**
   * 打开连接 → 执行 → 失败转 error 帧 → 关闭连接。
   * 把「try/catch/finally」收在这一层，Controller 就不用管了。
   */
  async pipe(
    executor: (send: (event: WorkflowStreamEvent) => void) => Promise<unknown>,
  ): Promise<void> {
    this.open();

    try {
      await executor(this.send);
    } catch (error) {
      this.fail(error);
    } finally {
      this.close();
    }
  }

  /**
   * 作为回调传给 service 时，this 不能丢，所以用箭头函数属性而不是普通方法。
   */
  private readonly send = (event: WorkflowStreamEvent): void => {
    if (this.closed) {
      return;
    }

    this.writeFrame(event.type, event);
  };

  private open(): void {
    if (this.res.headersSent) {
      return;
    }

    this.res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    this.res.setHeader('Cache-Control', 'no-cache, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.flushHeaders?.();
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.writeFrame('error', { message });
  }

  private close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    if (!this.res.writableEnded) {
      this.res.end();
    }
  }

  private writeFrame(type: string, payload: unknown): void {
    this.res.write(`event: ${type}\n`);
    this.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}