import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  PluginStatus,
  type PluginTool,
} from '@prisma/client';
import { ErrorCode } from '../../../../common/constants/error-code';
import { BusinessException } from '../../../../common/exceptions/business.exception';
import { PrismaService } from '../../../../database/prisma.service';
import { PluginExecutionService } from '../../../plugins/plugin-execution.service';
import {
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  WorkflowNodeExecutor,
} from './workflow-node-executor';

// PluginNodeExecutor：在工作流中直接调用已安装插件工具（不经 Agent 绑定）。
// 配置（data.inputs）：
// - pluginId: 插件 ID（当前工作区内、状态 ACTIVE）
// - toolId:   插件工具 ID
// - args:     { 参数名: 引用/字面量 }，逐项解析后作为工具入参
//
// 输出：
// - output: 工具原始输出（对象或字符串）
// - result: 输出的字符串序列化，便于 LLM 节点模板引用
@Injectable()
export class PluginNodeExecutor implements WorkflowNodeExecutor {
  readonly type = 'plugin';
  private readonly logger = new Logger(PluginNodeExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluginExecutionService: PluginExecutionService,
  ) {}

  async execute(
    context: WorkflowNodeExecutionContext,
  ): Promise<WorkflowNodeExecutionResult> {
    const inputs = this.asRecord(this.asRecord(context.node.data).inputs);

    const pluginId = context.resolveTemplate(
      this.readString(inputs.pluginId, ''),
    );
    const toolId = context.resolveTemplate(this.readString(inputs.toolId, ''));
    if (!pluginId || !toolId) {
      throw new BusinessException(
        'plugin 节点缺少 pluginId 或 toolId',
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }

    const workspaceId = context.state.variableContext.workspaceId;
    const userId = context.state.variableContext.globalKey;

    const plugin = await this.prisma.pluginDefinition.findFirst({
      where: { id: pluginId, workspaceId },
      include: { tools: { where: { id: toolId }, take: 1 } },
    });
    if (!plugin || !plugin.tools[0]) {
      throw new BusinessException(
        'plugin 节点指定的插件或工具不存在（须属于当前工作区）',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    if (plugin.status !== PluginStatus.ACTIVE || !plugin.invocationEnabled) {
      throw new BusinessException(
        `插件未启用或禁止调用: ${plugin.name}`,
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    const tool = plugin.tools[0];
    const args = this.resolveArguments(inputs.args, context);

    this.logger.debug(
      `[plugin] ${plugin.code}__${tool.code} args=${Object.keys(args).length}`,
    );

    const output = await this.pluginExecutionService.executeStandalone({
      plugin,
      tool,
      args,
      runId: `workflow:${workspaceId}:${Date.now()}`,
      conversationId: null,
      userId,
    });

    return {
      output: {
        output,
        result:
          typeof output === 'string' ? output : JSON.stringify(output ?? null),
      },
    };
  }

  private resolveArguments(
    value: unknown,
    context: WorkflowNodeExecutionContext,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(this.asRecord(value))) {
      resolved[key] = context.resolveValue(raw);
    }
    return resolved;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (this.isRecord(value)) {
      return value;
    }
    return {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private readString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return fallback;
  }
}
