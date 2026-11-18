import { HttpStatus } from '@nestjs/common';
import { WorkflowRunLimiter } from '../workflow-run-limiter.service';

// 造一个「手动控制何时结束」的任务
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('WorkflowRunLimiter 并发闸门', () => {
  it('同时在跑的任务数不超过上限', async () => {
    const limiter = new WorkflowRunLimiter({
      maxConcurrency: 2,
      maxQueue: 10,
      queueTimeoutMs: 1000,
    });

    let peak = 0;
    let current = 0;
    const gate = deferred();

    const task = async () => {
      current += 1;
      peak = Math.max(peak, current);
      await gate.promise;
      current -= 1;
    };

    const all = Array.from({ length: 5 }, () => limiter.runLimited(task));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(limiter.stats()).toEqual({ running: 2, queued: 3 });

    gate.resolve();
    await Promise.all(all);

    expect(peak).toBe(2);
    expect(limiter.stats()).toEqual({ running: 0, queued: 0 });
  });

  it('队列满了直接拒绝，返回 503', async () => {
    const limiter = new WorkflowRunLimiter({
      maxConcurrency: 1,
      maxQueue: 1,
      queueTimeoutMs: 1000,
    });
    const gate = deferred();
    const first = limiter.runLimited(() => gate.promise);
    const second = limiter.runLimited(() => gate.promise);

    await expect(limiter.runLimited(async () => undefined)).rejects.toMatchObject(
      { status: HttpStatus.SERVICE_UNAVAILABLE },
    );

    gate.resolve();
    await Promise.all([first, second]);
  });

  it('排队太久会超时失败，并且不占名额', async () => {
    const limiter = new WorkflowRunLimiter({
      maxConcurrency: 1,
      maxQueue: 5,
      queueTimeoutMs: 20,
    });
    const gate = deferred();
    const holder = limiter.runLimited(() => gate.promise);

    await expect(limiter.runLimited(async () => undefined)).rejects.toMatchObject(
      { status: HttpStatus.SERVICE_UNAVAILABLE },
    );

    gate.resolve();
    await holder;
    expect(limiter.stats()).toEqual({ running: 0, queued: 0 });
  });

  it('重复 release 不会把并发数放大', async () => {
    const limiter = new WorkflowRunLimiter({
      maxConcurrency: 1,
      maxQueue: 1,
      queueTimeoutMs: 1000,
    });

    await limiter.runLimited(async () => undefined);
    await limiter.runLimited(async () => undefined);

    expect(limiter.stats().running).toBe(0);
  });

  it('任务抛错时名额也会归还', async () => {
    const limiter = new WorkflowRunLimiter({
      maxConcurrency: 1,
      maxQueue: 1,
      queueTimeoutMs: 1000,
    });

    await expect(
      limiter.runLimited(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(limiter.stats().running).toBe(0);
    // 名额真的还回来了，第二个任务能立刻跑
    await expect(limiter.runLimited(async () => 'ok')).resolves.toBe('ok');
  });
});