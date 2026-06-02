import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-code';
import { BusinessException } from '../../common/exceptions/business.exception';

type ToolParamType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface ToolParamSchema {
  type: ToolParamType;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolParamSchema>;
  required?: string[];
}

export interface PluginTool {
  id: string;
  pluginId: string;
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  enabled: boolean;
}

export interface PluginDetail {
  id: string;
  name: string;
  icon?: string;
  description: string;
  enabled: boolean;
  version: string;
  toolCount: number;
  createdAt: string;
  tools: PluginTool[];
}

@Injectable()
export class PluginService {
  private readonly enabledState = new Map<string, boolean>();
  private readonly agentBindings = new Map<string, string[]>();

  private readonly plugins: PluginDetail[] = [
    {
      id: 'web-search',
      name: '网页搜索',
      icon: 'SearchOutlined',
      description: '为智能体提供实时网页检索、摘要提取和来源追踪能力。',
      enabled: true,
      version: '1.0.0',
      toolCount: 2,
      createdAt: '2026-01-10T08:00:00.000Z',
      tools: [
        {
          id: 'web-search.query',
          pluginId: 'web-search',
          name: '搜索网页',
          description: '根据关键词搜索网页并返回结构化摘要。',
          enabled: true,
          inputSchema: {
            type: 'object',
            required: ['query'],
            properties: {
              query: { type: 'string', description: '搜索关键词' },
              limit: { type: 'number', description: '返回结果数量', default: 5 },
            },
          },
        },
        {
          id: 'web-search.extract',
          pluginId: 'web-search',
          name: '提取网页内容',
          description: '读取指定 URL 的正文内容。',
          enabled: true,
          inputSchema: {
            type: 'object',
            required: ['url'],
            properties: {
              url: { type: 'string', description: '网页 URL' },
              includeLinks: { type: 'boolean', description: '是否包含链接', default: false },
            },
          },
        },
      ],
    },
    {
      id: 'knowledge-tools',
      name: '知识库工具',
      icon: 'DatabaseOutlined',
      description: '查询工作空间知识库，支持按关键词召回文档片段。',
      enabled: true,
      version: '1.1.0',
      toolCount: 1,
      createdAt: '2026-02-04T08:00:00.000Z',
      tools: [
        {
          id: 'knowledge-tools.retrieve',
          pluginId: 'knowledge-tools',
          name: '知识库召回',
          description: '从已启用知识库中检索相关内容。',
          enabled: true,
          inputSchema: {
            type: 'object',
            required: ['question'],
            properties: {
              question: { type: 'string', description: '用户问题' },
              topK: { type: 'number', description: '召回数量', default: 3 },
            },
          },
        },
      ],
    },
    {
      id: 'data-utils',
      name: '数据处理',
      icon: 'FunctionOutlined',
      description: '提供 JSON 格式化、字段映射和轻量计算能力。',
      enabled: false,
      version: '0.9.2',
      toolCount: 2,
      createdAt: '2026-03-18T08:00:00.000Z',
      tools: [
        {
          id: 'data-utils.json-format',
          pluginId: 'data-utils',
          name: 'JSON 格式化',
          description: '格式化或压缩 JSON 数据。',
          enabled: true,
          inputSchema: {
            type: 'object',
            required: ['payload'],
            properties: {
              payload: { type: 'object', description: '待处理 JSON' },
              mode: {
                type: 'string',
                enum: ['pretty', 'compact'],
                description: '输出模式',
                default: 'pretty',
              },
            },
          },
        },
        {
          id: 'data-utils.sum',
          pluginId: 'data-utils',
          name: '数字求和',
          description: '对数字数组求和。',
          enabled: true,
          inputSchema: {
            type: 'object',
            required: ['values'],
            properties: {
              values: { type: 'array', description: '数字数组', default: [1, 2, 3] },
            },
          },
        },
      ],
    },
  ];

  findAll() {
    return this.plugins.map((plugin) => {
      const { tools: _tools, ...summary } = this.applyState(plugin);
      return summary;
    });
  }

  findOne(pluginId: string) {
    return this.applyState(this.getPlugin(pluginId));
  }

  toggle(pluginId: string, enabled: boolean) {
    this.getPlugin(pluginId);
    this.enabledState.set(pluginId, enabled);
    return this.findOne(pluginId);
  }

  testTool(toolId: string, params: Record<string, unknown>) {
    const tool = this.getTool(toolId);
    const plugin = this.findOne(tool.pluginId);

    if (!plugin.enabled || !tool.enabled) {
      throw new BusinessException(
        '插件或工具未启用',
        ErrorCode.BusinessError,
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      success: true,
      data: {
        toolId,
        toolName: tool.name,
        params,
        output: '工具测试已由后端接收，真实外部能力接入后会在这里返回执行结果。',
      },
      duration: 1,
    };
  }

  getAgentBinding(agentId: string) {
    return { agentId, toolIds: this.agentBindings.get(agentId) ?? [] };
  }

  bindAgentTools(agentId: string, toolIds: string[]) {
    const validToolIds = new Set(
      this.plugins.flatMap((plugin) => this.applyState(plugin).tools)
        .filter((tool) => tool.enabled)
        .map((tool) => tool.id),
    );
    const nextToolIds = toolIds.filter((toolId) => validToolIds.has(toolId));
    this.agentBindings.set(agentId, nextToolIds);
    return { agentId, toolIds: nextToolIds };
  }

  private applyState(plugin: PluginDetail): PluginDetail {
    const enabled = this.enabledState.get(plugin.id) ?? plugin.enabled;

    return {
      ...plugin,
      enabled,
      tools: plugin.tools.map((tool) => ({ ...tool, enabled: enabled && tool.enabled })),
    };
  }

  private getPlugin(pluginId: string) {
    const plugin = this.plugins.find((item) => item.id === pluginId);

    if (!plugin) {
      throw new BusinessException(
        '插件不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return plugin;
  }

  private getTool(toolId: string) {
    const tool = this.plugins.flatMap((plugin) => plugin.tools).find((item) => item.id === toolId);

    if (!tool) {
      throw new BusinessException(
        '工具不存在',
        ErrorCode.NotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return tool;
  }
}
