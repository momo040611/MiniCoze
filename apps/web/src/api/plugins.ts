import { http, type ApiEnvelope } from './http';

export type PluginType = 'BUILTIN' | 'HTTP';
export type PluginStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
export type PluginToolStatus = 'ACTIVE' | 'DISABLED';

export interface IToolParamSchema {
  type: 'object';
  properties: Record<string, IToolParam>;
  required?: string[];
}

export interface IToolParam {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface IPluginTool {
  id: string;
  pluginId: string;
  code: string;
  name: string;
  description: string;
  inputSchema: IToolParamSchema;
  outputSchema: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  status: PluginToolStatus;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IPlugin {
  id: string;
  workspaceId: string;
  creatorId: string;
  code: string;
  name: string;
  icon?: string;
  iconUrl: string | null;
  description: string;
  type: PluginType;
  status: PluginStatus;
  enabled: boolean;
  invocationEnabled: boolean;
  isBuiltin: boolean;
  version: string;
  maskStrategy: Record<string, unknown> | null;
  toolCount: number;
  activeToolCount: number;
  credentialSummary?: {
    count: number;
    activeCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type IPluginDetail = IPlugin & { tools: IPluginTool[] };

export interface IPluginFormPayload {
  workspaceId?: string;
  code?: string;
  name?: string;
  description?: string;
  iconUrl?: string;
  type?: PluginType;
  version?: string;
  isBuiltin?: boolean;
  invocationEnabled?: boolean;
  maskStrategy?: Record<string, unknown>;
}

export interface IPluginToolFormPayload {
  code?: string;
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}

export interface IPluginInvocation {
  id: string;
  pluginId: string;
  agentId: string | null;
  conversationId: string | null;
  runId: string;
  toolCode: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'CANCELED';
  argsSummary: unknown;
  outputSummary: unknown;
  errorSummary: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface IPaginatedInvocations {
  list: IPluginInvocation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IPaginatedPlugins {
  list: IPlugin[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IGetPluginsParams {
  workspaceId: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: PluginType;
  status?: PluginStatus;
}

export interface IToolTestResult {
  success: boolean;
  data?: unknown;
  output?: unknown;
  error?: string | null;
  duration?: number;
  durationMs?: number;
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

interface BackendPaginated<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface BackendPluginTool {
  id: string;
  code: string;
  name: string;
  description: string;
  status: PluginToolStatus;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface BackendPluginDetail {
  id: string;
  workspaceId: string;
  creatorId: string;
  code: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  type: PluginType;
  status: PluginStatus;
  version: string;
  isBuiltin: boolean;
  invocationEnabled: boolean;
  maskStrategy: Record<string, unknown> | null;
  tools: BackendPluginTool[];
  credentialSummary?: {
    count: number;
    activeCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

type BackendPluginInvocation = IPluginInvocation;

interface BackendAgentPluginBinding {
  agentId: string;
  pluginId: string;
  status: 'ACTIVE' | 'DISABLED';
  config: {
    disabledTools?: string[];
  } | null;
}

function isEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return Boolean(payload && typeof payload === 'object' && 'data' in payload);
}

function unwrap<T>(payload: T | ApiEnvelope<T>): T {
  return isEnvelope<T>(payload) ? payload.data : payload;
}

function normalizeInputSchema(value: Record<string, unknown>): IToolParamSchema {
  const properties = value.properties;
  const required = value.required;

  return {
    type: 'object',
    properties:
      properties && typeof properties === 'object' && !Array.isArray(properties)
        ? (properties as Record<string, IToolParam>)
        : {},
    required: Array.isArray(required) ? required.filter((item): item is string => typeof item === 'string') : undefined,
  };
}

function mapTool(pluginId: string, tool: BackendPluginTool): IPluginTool {
  return {
    ...tool,
    pluginId,
    inputSchema: normalizeInputSchema(tool.inputSchema),
    enabled: tool.status === 'ACTIVE',
  };
}

function mapPlugin(plugin: BackendPluginDetail): IPluginDetail {
  const tools = plugin.tools.map((tool) => mapTool(plugin.id, tool));
  const enabled = plugin.status === 'ACTIVE' && plugin.invocationEnabled;

  return {
    id: plugin.id,
    workspaceId: plugin.workspaceId,
    creatorId: plugin.creatorId,
    code: plugin.code,
    name: plugin.name,
    icon: plugin.iconUrl ?? undefined,
    iconUrl: plugin.iconUrl,
    description: plugin.description ?? '暂无描述',
    type: plugin.type,
    status: plugin.status,
    enabled,
    invocationEnabled: plugin.invocationEnabled,
    isBuiltin: plugin.isBuiltin,
    version: plugin.version,
    maskStrategy: plugin.maskStrategy,
    toolCount: tools.length,
    activeToolCount: tools.filter((tool) => tool.enabled).length,
    credentialSummary: plugin.credentialSummary,
    createdAt: plugin.createdAt,
    updatedAt: plugin.updatedAt,
    tools,
  };
}

export async function getPlugins(params: IGetPluginsParams): Promise<IPaginatedPlugins> {
  const payload = await http.get<ApiEnvelope<BackendPaginated<BackendPluginDetail>>>('plugins', {
    query: {
      workspaceId: params.workspaceId,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      keyword: params.keyword,
      type: params.type,
      status: params.status,
    },
  });
  const data = payload.data;

  return {
    ...data,
    list: data.list.map((plugin) => {
      const { tools: _tools, ...summary } = mapPlugin(plugin);
      return summary;
    }),
  };
}

export async function getPluginDetail(pluginId: string): Promise<IPluginDetail> {
  const payload = await http.get<ApiEnvelope<BackendPluginDetail>>(`plugins/${pluginId}`);
  return mapPlugin(payload.data);
}

export async function togglePlugin(pluginId: string, enabled: boolean): Promise<IPluginDetail> {
  const payload = await http.post<ApiEnvelope<BackendPluginDetail>>(
    `plugins/${pluginId}/${enabled ? 'activate' : 'disable'}`,
  );
  return mapPlugin(payload.data);
}

export async function createPlugin(payload: Required<Pick<IPluginFormPayload, 'workspaceId' | 'code' | 'name'>> & IPluginFormPayload): Promise<IPluginDetail> {
  const res = await http.post<ApiEnvelope<BackendPluginDetail>, IPluginFormPayload>('plugins', payload);
  return mapPlugin(res.data);
}

export async function updatePlugin(pluginId: string, payload: IPluginFormPayload): Promise<IPluginDetail> {
  const res = await http.patch<ApiEnvelope<BackendPluginDetail>, IPluginFormPayload>(`plugins/${pluginId}`, payload);
  return mapPlugin(res.data);
}

export async function createPluginTool(
  pluginId: string,
  payload: Required<Pick<IPluginToolFormPayload, 'code' | 'name' | 'description' | 'inputSchema'>> & IPluginToolFormPayload,
): Promise<IPluginTool> {
  const res = await http.post<ApiEnvelope<BackendPluginTool>, IPluginToolFormPayload>(`plugins/${pluginId}/tools`, payload);
  return mapTool(pluginId, res.data);
}

export async function updatePluginTool(
  pluginId: string,
  toolId: string,
  payload: IPluginToolFormPayload,
): Promise<IPluginTool> {
  const res = await http.patch<ApiEnvelope<BackendPluginTool>, IPluginToolFormPayload>(
    `plugins/${pluginId}/tools/${toolId}`,
    payload,
  );
  return mapTool(pluginId, res.data);
}

export async function getPluginInvocations(
  pluginId: string,
  params: { workspaceId: string; page?: number; pageSize?: number },
): Promise<IPaginatedInvocations> {
  const res = await http.get<ApiEnvelope<BackendPaginated<BackendPluginInvocation>>>(`plugins/${pluginId}/invocations`, {
    query: {
      workspaceId: params.workspaceId,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
    },
  });
  return res.data;
}

export async function testTool(
  toolId: string,
  params: Record<string, unknown>,
  pluginId?: string,
): Promise<IToolTestResult> {
  if (!pluginId) {
    throw new Error('缺少插件 ID，无法测试工具');
  }

  const payload = await http.post<
    ApiEnvelope<{ success: boolean; output: unknown; error: string | null; durationMs: number }>,
    { arguments: Record<string, unknown> }
  >(`plugins/${pluginId}/tools/${toolId}/test`, { arguments: params });
  const result = payload.data;

  return {
    success: result.success,
    data: result.output,
    output: result.output,
    error: result.error,
    duration: result.durationMs,
    durationMs: result.durationMs,
  };
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
  const bindingsPayload = await http.get<ApiEnvelope<BackendAgentPluginBinding[]>>(`agents/${agentId}/plugins`);
  const bindings = bindingsPayload.data.filter((binding) => binding.status === 'ACTIVE');
  const details = await Promise.all(bindings.map((binding) => getPluginDetail(binding.pluginId)));
  const disabledByPlugin = new Map(bindings.map((binding) => [binding.pluginId, new Set(binding.config?.disabledTools ?? [])]));

  return {
    agentId,
    toolIds: details.flatMap((plugin) => {
      const disabledTools = disabledByPlugin.get(plugin.id) ?? new Set<string>();
      return plugin.tools
        .filter((tool) => tool.enabled && !disabledTools.has(tool.code))
        .map((tool) => tool.id);
    }),
  };
}

export async function bindAgentTools(agentId: string, tools: IPluginTool[]): Promise<void> {
  const pluginMap = new Map<string, IPluginDetail>();
  const selectedToolIds = new Set(tools.map((tool) => tool.id));

  await Promise.all(
    tools.map(async (tool) => {
      const pluginId = tool.pluginId;
      if (pluginMap.has(pluginId)) return;
      try {
        pluginMap.set(pluginId, await getPluginDetail(pluginId));
      } catch {
        // Ignore stale local selections; backend validation remains authoritative.
      }
    }),
  );

  await http.put(`agents/${agentId}/plugins`, {
    bindings: Array.from(pluginMap.values()).map((plugin, index) => ({
      pluginId: plugin.id,
      status: 'ACTIVE',
      autoInvoke: true,
      sortOrder: index,
      config: {
        disabledTools: plugin.tools
          .filter((tool) => tool.enabled && !selectedToolIds.has(tool.id))
          .map((tool) => tool.code),
      },
    })),
  });
}
