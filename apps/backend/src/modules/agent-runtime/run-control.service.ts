import { Injectable } from '@nestjs/common';

interface RunControlEntry {
  controller: AbortController;
  /** 触发运行的登录用户，用于取消时的归属校验。 */
  userId: string;
  workspaceId: string;
}

/**
 * 运行中控注册表：
 * - 每个 run 注册一个 AbortController，取消接口通过它把信号广播给 runtime / 模型流 / 工具执行。
 * - 进程内实现：单实例部署下够用；多实例部署时 DB 侧 AgentRun 表仍能正确落「CANCELED 之外的终态」，
 *   后续如需跨实例取消可换 Redis Pub/Sub，这里保持依赖最小。
 */
@Injectable()
export class RunControlService {
  private readonly controls = new Map<string, RunControlEntry>();

  register(runId: string, entry: Omit<RunControlEntry, 'controller'>): AbortController {
    // 同 runId 重复注册只可能来自异常重入，直接丢弃旧控制器。
    this.controls.set(runId, { ...entry, controller: new AbortController() });
    return this.controls.get(runId)!.controller;
  }

  get(runId: string): RunControlEntry | undefined {
    return this.controls.get(runId);
  }

  /**
   * 取消指定运行。返回：
   * - 'canceled'：存在该运行且已成功 abort
   * - 'forbidden'：存在但归属校验不通过
   * - 'not_found'：运行已结束或不存在（终态会自动清理）
   */
  cancel(
    runId: string,
    userId: string,
    ensureWorkspaceMember?: (userId: string, workspaceId: string) => Promise<void>,
  ): 'canceled' | 'forbidden' | 'not_found' {
    const entry = this.controls.get(runId);
    if (!entry) return 'not_found';

    if (entry.userId !== userId && !ensureWorkspaceMember) {
      return 'forbidden';
    }

    entry.controller.abort('canceled');
    return 'canceled';
  }

  release(runId: string): void {
    this.controls.delete(runId);
  }
}
