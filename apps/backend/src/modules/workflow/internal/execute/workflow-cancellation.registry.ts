import { Injectable } from '@nestjs/common';

// 工作流被取消时抛出的专用错误，用于和普通执行失败区分（最终落库为 CANCELED）。
export class WorkflowCanceledError extends Error {
  constructor(message = '工作流运行已被取消') {
    super(message);
    this.name = 'WorkflowCanceledError';
  }
}

// 取消信号登记处（单进程内存版）：
// - cancel 接口往里写 runId
// - runner 在每个节点前查询 runId 是否被取消
// 注意：仅适用于单实例部署；多实例需改用 Redis 等共享存储。
@Injectable()
export class WorkflowCancellationRegistry {
  private readonly canceled = new Set<string>();

  // 标记某次运行为「请求取消」。
  request(runId: string): void {
    this.canceled.add(runId);
  }

  // 查询某次运行是否已被请求取消。
  isCanceled(runId: string): boolean {
    return this.canceled.has(runId);
  }

  // 运行结束后清理，避免内存泄漏。
  clear(runId: string): void {
    this.canceled.delete(runId);
  }
}
