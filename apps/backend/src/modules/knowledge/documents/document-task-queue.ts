import { Injectable, Logger } from '@nestjs/common';

/**
 * 进程内文档处理任务队列（MVP，不引入 Redis/BullMQ）。
 * - 并发上限 2：避免大文档解析/embedding 把事件循环和外部 API 打满。
 * - 任务异常只记录日志，不冒泡（调用方已在任务内负责状态回写）。
 * - 进程重启后队列丢失：由 KnowledgeDocumentService.onModuleInit 把
 *   非终态文档标记为 FAILED，支持用户手动重试。
 */
@Injectable()
export class DocumentTaskQueue {
  private readonly logger = new Logger(DocumentTaskQueue.name);
  private readonly concurrency = 2;
  private running = 0;
  private readonly pending: Array<() => Promise<void>> = [];

  enqueue(task: () => Promise<void>): void {
    this.pending.push(task);
    void this.drain();
  }

  get size(): number {
    return this.pending.length + this.running;
  }

  private async drain(): Promise<void> {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) {
        return;
      }
      this.running++;
      try {
        await task();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`后台文档处理任务失败: ${message}`);
      } finally {
        this.running--;
      }
    }
  }
}
