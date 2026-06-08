import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';
import { PrismaService } from '../../database/prisma.service';
import { type RuntimeContext } from '../../shared/types/runtime';
import {
  type AgentPluginBindingConfig,
  type ResolvedPluginTool,
} from './types/plugin.types';

@Injectable()
export class PluginResolverService {
  constructor(private readonly prisma: PrismaService) {}

  private getBindingConfig(value: unknown): AgentPluginBindingConfig | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value;
  }

  async resolve(
    functionName: string,
    context: RuntimeContext,
  ): Promise<ResolvedPluginTool> {
    const { pluginCode, toolCode } = this.parseFunctionName(functionName);

    const binding = await this.prisma.agentPluginBinding.findFirst({
      where: {
        agentId: context.agentId,
        status: 'ACTIVE',
        plugin: {
          code: pluginCode,
          status: 'ACTIVE',
          invocationEnabled: true,
        },
      },
      include: {
        plugin: {
          include: {
            tools: {
              where: {
                code: toolCode,
                status: 'ACTIVE',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!binding || !binding.plugin?.tools?.[0]) {
      throw new BusinessException(
        `插件工具不存在或未绑定: ${functionName}`,
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const bindingConfig = this.getBindingConfig(binding.config);
    const disabledTools = Array.isArray(bindingConfig?.disabledTools)
      ? bindingConfig.disabledTools
      : [];
    if (disabledTools.includes(toolCode)) {
      throw new BusinessException(
        `插件工具已被 Agent 禁用: ${functionName}`,
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      binding,
      plugin: binding.plugin,
      tool: binding.plugin.tools[0],
      metadata: {
        toolKind: 'plugin',
        pluginId: binding.plugin.id,
        pluginCode,
        toolCode,
      },
    };
  }

  private parseFunctionName(functionName: string): {
    pluginCode: string;
    toolCode: string;
  } {
    const [pluginCode, toolCode, extra] = functionName.split('__');
    if (!pluginCode || !toolCode || extra) {
      throw new BusinessException(
        `非法的插件函数名: ${functionName}`,
        ErrorCode.BadRequest,
        HttpStatus.BAD_REQUEST,
      );
    }
    return { pluginCode, toolCode };
  }
}
