import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, WorkflowVariableScope } from '@prisma/client';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PrismaService } from '../../../../database/prisma.service';

// 持久化变量的读写服务：实现工作流“记忆”能力的存储层。
// 变量按 (workspaceId, scope, scopeKey, name) 唯一定位：
// - SESSION 作用域：scopeKey = sessionId（一次会话内多轮共享）
// - GLOBAL  作用域：scopeKey = userId（跨会话永久保存）
@Injectable()
export class WorkflowVariableService {
  private readonly logger = new Logger(WorkflowVariableService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 批量加载某作用域下的全部变量，返回 name -> value 的映射。
  // 运行开始时调用，把库里的变量注入运行时内存，供 {{session.x}} / {{global.x}} 读取。
  async loadScope(
    workspaceId: string,
    scope: WorkflowVariableScope,
    scopeKey: string | undefined,
  ): Promise<Record<string, unknown>> {
    if (!scopeKey) {
      return {};
    }
    let rows: Array<{ name: string; value: unknown }>;

    try {
      rows = await this.prisma.workflowVariable.findMany({
        where: { workspaceId, scope, scopeKey },
      });
    } catch (error) {
      if (this.isMissingWorkflowVariableTable(error)) {
        this.logger.warn(
          'WorkflowVariable table is missing; persistent workflow variables are disabled until migrations are applied.',
        );
        return {};
      }

      throw error;
    }

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.name] = row.value;
    }
    return result;
  }

  // 写入（存在则更新）一个变量。set 节点执行时调用。
  async set(
    workspaceId: string,
    scope: WorkflowVariableScope,
    scopeKey: string,
    name: string,
    value: unknown,
  ): Promise<void> {
    const jsonValue = this.toJsonValue(value);
    try {
      await this.prisma.workflowVariable.upsert({
        where: {
          workspaceId_scope_scopeKey_name: {
            workspaceId,
            scope,
            scopeKey,
            name,
          },
        },
        create: { workspaceId, scope, scopeKey, name, value: jsonValue },
        update: { value: jsonValue },
      });
    } catch (error) {
      if (this.isMissingWorkflowVariableTable(error)) {
        throw new BusinessException(
          '工作流变量表不存在，请先执行数据库迁移后再使用变量节点',
          ErrorCode.BadRequest,
          HttpStatus.BAD_REQUEST,
        );
      }

      throw error;
    }
  }

  // 把任意值转成 Prisma 可存的 Json；null/undefined 统一存为 JSON null。
  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    if (value === undefined || value === null) {
      return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
    }
    return value;
  }

  private isMissingWorkflowVariableTable(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const record = error as { code?: unknown; message?: unknown };
    const message = typeof record.message === 'string' ? record.message : '';

    return (
      record.code === 'P2021' ||
      message.includes('WorkflowVariable') && message.includes('does not exist')
    );
  }
}
