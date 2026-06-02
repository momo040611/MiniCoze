import { http, type ApiEnvelope } from './http';

export interface IPlugin {
  id: string;
  name: string;
  icon?: string;
  description: string;
  enabled: boolean;
  version: string;
  toolCount: number;
  createdAt: string;
}

export interface IPluginTool {
  id: string;
  pluginId: string;
  name: string;
  description: string;
  inputSchema: IToolParamSchema;
  enabled: boolean;
}

export interface IToolParamSchema {
  type: 'object';
  properties: Record<string, IToolParam>;
  required?: string[];
}

export interface IToolParam {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface IToolTestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration?: number;
}

export interface IAgentToolBinding {
  agentId: string;
  toolIds: string[];
}

export interface IToolCallRecord {
  callId: string;
  toolName: string;
  toolIcon?: string;
  params: Record<string, unknown>;
  status: 'running' | 'success' | 'failed';
  result?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export type IPluginDetail = IPlugin & { tools: IPluginTool[] };

const PLUGIN_STATE_KEY = 'miniCoze_plugin_enabled_state';
const AGENT_BINDING_KEY = 'miniCoze_agent_tool_bindings';

const fixturePlugins: IPluginDetail[] = [
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
        enabled: false,
        inputSchema: {
          type: 'object',
          required: ['payload'],
          properties: {
            payload: { type: 'object', description: '待处理 JSON' },
            mode: { type: 'string', enum: ['pretty', 'compact'], description: '输出模式', default: 'pretty' },
          },
        },
      },
      {
        id: 'data-utils.sum',
        pluginId: 'data-utils',
        name: '数字求和',
        description: '对数字数组求和。',
        enabled: false,
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

function isEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return Boolean(payload && typeof payload === 'object' && 'data' in payload);
}

function unwrap<T>(payload: T | ApiEnvelope<T>): T {
  return isEnvelope<T>(payload) ? payload.data : payload;
}

function readRecord<T>(key: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function writeRecord<T>(key: string, value: Record<string, T>) {
  localStorage.setItem(key, JSON.stringify(value));
}

function applyLocalState(plugin: IPluginDetail): IPluginDetail {
  const state = readRecord<boolean>(PLUGIN_STATE_KEY);
  const enabled = state[plugin.id] ?? plugin.enabled;
  return {
    ...plugin,
    enabled,
    tools: plugin.tools.map((tool) => ({ ...tool, enabled: enabled && tool.enabled })),
  };
}

function getFixtureDetail(pluginId: string): IPluginDetail {
  const detail = fixturePlugins.find((plugin) => plugin.id === pluginId);
  if (!detail) {
    throw new Error('插件不存在');
  }
  return applyLocalState(detail);
}

export async function getPlugins(): Promise<IPlugin[]> {
  try {
    const payload = await http.get<IPlugin[] | ApiEnvelope<IPlugin[]>>('plugins');
    return unwrap(payload);
  } catch {
    return fixturePlugins.map(applyLocalState).map(({ tools: _tools, ...plugin }) => plugin);
  }
}

export async function getPluginDetail(pluginId: string): Promise<IPluginDetail> {
  try {
    const payload = await http.get<IPluginDetail | ApiEnvelope<IPluginDetail>>(`plugins/${pluginId}`);
    return unwrap(payload);
  } catch {
    return getFixtureDetail(pluginId);
  }
}

export async function togglePlugin(pluginId: string, enabled: boolean): Promise<IPluginDetail> {
  try {
    const payload = await http.patch<IPluginDetail | ApiEnvelope<IPluginDetail>>(`plugins/${pluginId}/toggle`, { enabled });
    return unwrap(payload);
  } catch {
    const state = readRecord<boolean>(PLUGIN_STATE_KEY);
    state[pluginId] = enabled;
    writeRecord(PLUGIN_STATE_KEY, state);
    return getFixtureDetail(pluginId);
  }
}

export async function testTool(toolId: string, params: Record<string, unknown>): Promise<IToolTestResult> {
  const startedAt = performance.now();
  try {
    const payload = await http.post<IToolTestResult | ApiEnvelope<IToolTestResult>, { params: Record<string, unknown> }>(
      `tools/${toolId}/test`,
      { params },
    );
    return unwrap(payload);
  } catch (error) {
    const tool = fixturePlugins.flatMap((plugin) => plugin.tools).find((item) => item.id === toolId);
    if (!tool) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '工具测试失败',
        duration: Math.round(performance.now() - startedAt),
      };
    }

    return {
      success: true,
      data: {
        toolId,
        toolName: tool.name,
        params,
        output: '这是本地模拟的工具测试结果，后端接入后会返回真实数据。',
      },
      duration: Math.round(performance.now() - startedAt),
    };
  }
}

export async function getAgentTools(agentId: string): Promise<IToolCallRecord[]> {
  try {
    const payload = await http.get<IToolCallRecord[] | ApiEnvelope<IToolCallRecord[]>>(`agents/${agentId}/tool-calls`);
    return unwrap(payload);
  } catch {
    return [];
  }
}

export async function getAgentToolBinding(agentId: string): Promise<IAgentToolBinding> {
  try {
    const payload = await http.get<IAgentToolBinding | ApiEnvelope<IAgentToolBinding>>(`agents/${agentId}/tools`);
    return unwrap(payload);
  } catch {
    const bindings = readRecord<string[]>(AGENT_BINDING_KEY);
    return { agentId, toolIds: bindings[agentId] ?? [] };
  }
}

export async function bindAgentTools(agentId: string, toolIds: string[]): Promise<void> {
  try {
    await http.put(`agents/${agentId}/tools`, { toolIds });
  } catch {
    const bindings = readRecord<string[]>(AGENT_BINDING_KEY);
    bindings[agentId] = toolIds;
    writeRecord(AGENT_BINDING_KEY, bindings);
  }
}
