import { Injectable } from '@nestjs/common';
import { Prisma, WorkflowVariableScope } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';

// 持久化变量的读写服务：实现工作流“记忆”能力的存储层。
// 变量按 (workspaceId, scope, scopeKey, name) 唯一定位：
// - SESSION 作用域：scopeKey = sessionId（一次会话内多轮共享）
// - GLOBAL  作用域：scopeKey = userId（跨会话永久保存）
@Injectable()
export class WorkflowVariableService {
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
    const rows = await this.prisma.workflowVariable.findMany({
      where: { workspaceId, scope, scopeKey },
    });
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
  }

  // 把任意值转成 Prisma 可存的 Json；null/undefined 统一存为 JSON null。
  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    if (value === undefined || value === null) {
      return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
    }
    return value;
  }
}
