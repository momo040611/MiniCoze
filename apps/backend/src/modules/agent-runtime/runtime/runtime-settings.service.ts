import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface WorkspaceRuntimeSettings {
  maxToolRounds: number;
  maxRunDurationMs: number;
  requestTimeoutMs: number;
  retryCount: number;
}

const DEFAULTS: WorkspaceRuntimeSettings = {
  // 工具循环轮次上限：防止模型反复要求调工具导致死循环烧 token。
  maxToolRounds: 10,
  // 单次运行总时长上限（毫秒）：兜底所有模型调用 + 工具执行的总耗时。
  maxRunDurationMs: 5 * 60 * 1000,
  requestTimeoutMs: 60 * 1000,
  retryCount: 0,
};

const MAX_TOOL_ROUNDS = 50;
const MAX_RUN_DURATION_MS = 30 * 60 * 1000;

/**
 * 工作区运行设置读取器：
 * WorkspaceRuntimeSetting 表的运行参数（maxToolRounds/maxRunDurationMs 等）此前只存不读，
 * 这里统一收敛读取口径：表值 > 内置默认值，并夹紧到安全上限。
 */
@Injectable()
export class RuntimeSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(workspaceId: string): Promise<WorkspaceRuntimeSettings> {
    const setting = await this.prisma.workspaceRuntimeSetting.findUnique({
      where: { workspaceId },
      select: {
        maxToolRounds: true,
        maxRunDurationMs: true,
        requestTimeoutMs: true,
        retryCount: true,
      },
    });

    return {
      maxToolRounds: clamp(setting?.maxToolRounds, 1, MAX_TOOL_ROUNDS, DEFAULTS.maxToolRounds),
      maxRunDurationMs: clamp(
        setting?.maxRunDurationMs,
        5_000,
        MAX_RUN_DURATION_MS,
        DEFAULTS.maxRunDurationMs,
      ),
      requestTimeoutMs: clamp(
        setting?.requestTimeoutMs,
        5_000,
        MAX_RUN_DURATION_MS,
        DEFAULTS.requestTimeoutMs,
      ),
      retryCount: clamp(setting?.retryCount, 0, 3, DEFAULTS.retryCount),
    };
  }
}

function clamp(value: number | null | undefined, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}
