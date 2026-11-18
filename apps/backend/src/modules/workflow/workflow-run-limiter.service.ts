import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';

interface Waiter {
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface RunLimiterOptions {
  maxConcurrency?: number;
  maxQueue?: number;
  queueTimeoutMs?: number;
}

// 工作流运行闸门：限制「同时在跑的 run 数」，并给排队设上限和超时。
// 语义对应 Java 的 ThreadPoolExecutor(max, max, queue, AbortPolicy)。
@Injectable()
export class WorkflowRunLimiter {
  private readonly logger = new Logger(WorkflowRunLimiter.name);
  private readonly maxConcurrency: number;
  private readonly maxQueue: number;
  private readonly queueTimeoutMs: number;

  private running = 0;
  private readonly queue: Waiter[] = [];

  constructor(options: RunLimiterOptions = {}) {
    this.maxConcurrency =
      options.maxConcurrency ??
      this.readPositiveInt(process.env.WORKFLOW_MAX_CONCURRENCY, 4);
    this.maxQueue =
      options.maxQueue ?? this.readPositiveInt(process.env.WORKFLOW_MAX_QUEUE, 20);
    this.queueTimeoutMs =
      options.queueTimeoutMs ??
      this.readPositiveInt(process.env.WORKFLOW_QUEUE_TIMEOUT_MS, 30_000);
  }

  stats(): { running: number; queued: number } {
    return { running: this.running, queued: this.queue.length };
  }

  // 包一层：拿到名额后执行，无论成功失败都归还名额（finally 不能漏）。
  async runLimited<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private acquire(): Promise<() => void> {
    if (this.running < this.maxConcurrency) {
      this.running += 1;
      return Promise.resolve(this.createRelease());
    }

    if (this.queue.length >= this.maxQueue) {
      this.logger.warn(
        `⛔ 工作流并发已满 running=${this.running} queued=${this.queue.length}`,
      );
      return Promise.reject(
        new BusinessException(
          '工作流正在满负荷运行，请稍后重试',
          ErrorCode.ServiceUnavailable,
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );
    }

    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.queue.indexOf(waiter);
          if (index >= 0) {
            this.queue.splice(index, 1);
          }
          reject(
            new BusinessException(
              `工作流排队超时（${this.queueTimeoutMs}ms），请稍后重试`,
              ErrorCode.ServiceUnavailable,
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
          );
        }, this.queueTimeoutMs),
      };
      this.queue.push(waiter);
      this.logger.log(
        `⏳ 工作流排队 running=${this.running} queued=${this.queue.length}`,
      );
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      // 幂等：重复 release 不能把计数减成负数，否则闸门会被放大
      if (released) return;
      released = true;
      this.running -= 1;

      const next = this.queue.shift();
      if (next) {
        clearTimeout(next.timer);
        this.running += 1;
        next.resolve(this.createRelease());
      }
    };
  }

  private readPositiveInt(raw: string | undefined, fallback: number): number {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}