// 智能体配置模块 API — 对接后端 NestJS 接口
// 后端目前没有 mode / orchestration 字段，这两个字段前端本地暂存

import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';

const DEFAULT_AGENT_MODEL = 'deepseek-v4-flash';

// ---- 类型定义 ----
/** 后端 Agent 模型字段 */
interface BackendAgent {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  systemPrompt: string;
  model: string;
  temperature: number;
  openingMessage: string | null;
  contextLimit: number;
  status: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}
/** 后端分页响应 */
interface PaginatedAgents {
  list: BackendAgent[];
  total: number;
  page: number;
  pageSize: number;
}
/** 前端使用的 Agent 类型（含本地扩展字段） */
export interface AgentConfig {
  id: string;
  name: string;
  avatar: string;
  description: string;
  mode: 'chat' | 'single' | 'multi';
  persona: string;
  orchestration: string;
  createdAt: string;
  /** 后端独有字段，前端可选择性使用 */
  model?: string;
  temperature?: number;
  openingMessage?: string;
  contextLimit?: number;
  status?: string;
  workspaceId?: string;
}

// ---- 本地扩展字段存储（mode / orchestration，后端暂无） ----
const EXTRA_STORAGE_KEY = 'miniCoze_agent_extras';
interface AgentExtras {
  mode: 'chat' | 'single' | 'multi';
  orchestration: string;
}

function loadExtras(): Record<string, AgentExtras> {
  try {
    const raw = localStorage.getItem(EXTRA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveExtras(extras: Record<string, AgentExtras>) {
  try {
    localStorage.setItem(EXTRA_STORAGE_KEY, JSON.stringify(extras));
  } catch {
    // ignore
  }
}

function getDefaultExtras(): AgentExtras {
  return { mode: 'chat', orchestration: '' };
}

function mergeBackendOpening(orchestration: string, openingMessage: string | null): string {
  if (!openingMessage) return orchestration;

  try {
    const parsed = orchestration ? JSON.parse(orchestration) : {};
    if (!parsed || typeof parsed !== 'object') {
      return JSON.stringify({ opening: { openingMessage } });
    }

    const config = parsed as Record<string, unknown>;
    const currentOpening =
      config.opening && typeof config.opening === 'object'
        ? (config.opening as Record<string, unknown>)
        : {};

    return JSON.stringify({
      ...config,
      opening: {
        ...currentOpening,
        openingMessage,
      },
    });
  } catch {
    return JSON.stringify({ opening: { openingMessage } });
  }
}

// ---- 字段映射工具 ----
/** 后端 Agent → 前端 AgentConfig（合并本地扩展字段） */
function toAgentConfig(backend: BackendAgent): AgentConfig {
  const extras = loadExtras()[backend.id] ?? getDefaultExtras();
  const orchestration = mergeBackendOpening(
    extras.orchestration,
    backend.openingMessage,
  );

  return {
    id: backend.id,
    name: backend.name,
    avatar: backend.avatarUrl ?? '',
    description: backend.description ?? '',
    persona: backend.systemPrompt ?? '',
    mode: extras.mode,
    orchestration,
    createdAt: backend.createdAt,
    model: backend.model,
    temperature: backend.temperature,
    openingMessage: backend.openingMessage ?? '',
    contextLimit: backend.contextLimit,
    status: backend.status,
    workspaceId: backend.workspaceId,
  };
}

// ---- API 方法 ----
/** 创建智能体 */
export async function createAgent(params: {
  name: string;
  avatar: string;
  description: string;
  model?: string;
  mode?: 'chat' | 'single' | 'multi';
}): Promise<AgentConfig> {
  const workspaceId = await getCurrentWorkspaceId();

  const res = await http.post<ApiEnvelope<BackendAgent>>('agents', {
    workspaceId,
    name: params.name,
    description: params.description || undefined,
    avatarUrl: params.avatar || undefined,
    systemPrompt: '',
    model: params.model ?? DEFAULT_AGENT_MODEL,
    temperature: 0.7,
    contextLimit: 20,
  });

  const backend = res.data;

  // 保存本地扩展字段
  const extras = loadExtras();
  extras[backend.id] = {
    mode: params.mode ?? 'chat',
    orchestration: '',
  };
  saveExtras(extras);

  return toAgentConfig(backend);
}

/** 获取智能体列表 */
export async function getAgentList(params?: {
  keyword?: string;
  status?: string;
}): Promise<AgentConfig[]> {
  const workspaceId = await getCurrentWorkspaceId();

  const res = await http.get<ApiEnvelope<PaginatedAgents>>('agents', {
    query: {
      workspaceId,
      page: 1,
      pageSize: 50,
      keyword: params?.keyword,
      status: params?.status,
    },
  });

  return res.data.list.map(toAgentConfig);
}

/** 获取单个智能体详情 */
export async function getAgentDetail(id: string): Promise<AgentConfig | null> {
  try {
    const res = await http.get<ApiEnvelope<BackendAgent>>(`agents/${id}`);
    return toAgentConfig(res.data);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

/** 删除智能体 */
export async function deleteAgent(id: string): Promise<void> {
  await http.delete(`agents/${id}`);
  // 清理本地扩展字段
  const extras = loadExtras();
  delete extras[id];
  saveExtras(extras);
}
/** 更新智能体配置 */
export async function updateAgent(
  id: string,
  patch: Partial<Pick<AgentConfig, 'name' | 'avatar' | 'description' | 'mode' | 'persona' | 'orchestration' | 'model' | 'temperature' | 'openingMessage' | 'contextLimit' | 'status'>>,
): Promise<AgentConfig | null> {
  // 分离后端字段和本地扩展字段
  const backendPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) backendPatch.name = patch.name;
  if (patch.description !== undefined) backendPatch.description = patch.description;
  if (patch.avatar !== undefined) backendPatch.avatarUrl = patch.avatar;
  if (patch.persona !== undefined) backendPatch.systemPrompt = patch.persona;
  if (patch.model !== undefined) backendPatch.model = patch.model;
  if (patch.temperature !== undefined) backendPatch.temperature = patch.temperature;
  if (patch.openingMessage !== undefined) backendPatch.openingMessage = patch.openingMessage;
  if (patch.contextLimit !== undefined) backendPatch.contextLimit = patch.contextLimit;
  if (patch.status !== undefined) backendPatch.status = patch.status;

  // 更新后端
  const res = await http.patch<ApiEnvelope<BackendAgent>>(`agents/${id}`, backendPatch);

  // 更新本地扩展字段
  if (patch.mode !== undefined || patch.orchestration !== undefined) {
    const extras = loadExtras();
    const current = extras[id] ?? getDefaultExtras();
    extras[id] = {
      mode: patch.mode ?? current.mode,
      orchestration: patch.orchestration ?? current.orchestration,
    };
    saveExtras(extras);
  }

  return toAgentConfig(res.data);
}

export { setupAgentMocks } from './setup-mocks';
