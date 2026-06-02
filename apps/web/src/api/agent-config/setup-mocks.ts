import { registerMockHandler } from '../http';

let registered = false;

interface MockAgent {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  systemPrompt: string;
  model: string;
  temperature: number;
  status: string;
  workspaceId: string;
  openingMessage: string | null;
  contextLimit: number;
  createdAt: string;
  updatedAt: string;
}

const mockAgents: MockAgent[] = [
  {
    id: 'agent-001',
    name: 'AI 助手',
    description: '通用 AI 对话助手',
    avatarUrl: null,
    systemPrompt: '你是一个有用的AI助手。',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    openingMessage: null,
    contextLimit: 20,
    status: 'ACTIVE',
    workspaceId: 'default-workspace',
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
  },
  {
    id: 'agent-002',
    name: '代码审查助手',
    description: '帮助你审查代码质量和风格',
    avatarUrl: null,
    systemPrompt: '你是一个专业的代码审查助手。',
    model: 'gpt-4o-mini',
    temperature: 0.5,
    openingMessage: null,
    contextLimit: 20,
    status: 'ACTIVE',
    workspaceId: 'default-workspace',
    createdAt: '2025-06-02T00:00:00Z',
    updatedAt: '2025-06-02T00:00:00Z',
  },
];

export function setupAgentMocks() {
  if (registered) return;
  registered = true;

  // ① 列表：GET /agents
  registerMockHandler('GET', 'agents', async () => ({
    code: 0,
    message: 'ok',
    data: {
      list: mockAgents,
      total: mockAgents.length,
      page: 1,
      pageSize: 50,
    },
  }));

  // ② 创建：POST /agents
  registerMockHandler('POST', 'agents', async (body) => {
    const params = body as {
      name: string;
      workspaceId: string;
      description?: string;
      avatarUrl?: string;
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      status?: string;
    };
    const newAgent: MockAgent = {
      id: `agent-${Date.now()}`,
      name: params.name,
      description: params.description ?? '',
      avatarUrl: params.avatarUrl ?? null,
      systemPrompt: params.systemPrompt ?? '',
      model: params.model ?? 'gpt-4o-mini',
      temperature: params.temperature ?? 0.7,
      openingMessage: null,
      contextLimit: 20,
      status: params.status ?? 'ACTIVE',
      workspaceId: params.workspaceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockAgents.push(newAgent);
    return { code: 0, message: 'ok', data: newAgent };
  });

  // ③ 更新：PATCH /agents/:id（通过前缀匹配命中 /agents/xxx）
  registerMockHandler('PATCH', 'agents', async (body, _headers, path) => {
    const params = body as {
      name?: string;
      description?: string;
      avatarUrl?: string;
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      openingMessage?: string;
      contextLimit?: number;
      status?: string;
    };
    const agentId = path.split('/').pop() ?? '';
    const agent = mockAgents.find((a) => a.id === agentId);
    if (agent) {
      if (params.name !== undefined) agent.name = params.name;
      if (params.description !== undefined) agent.description = params.description;
      if (params.avatarUrl !== undefined) agent.avatarUrl = params.avatarUrl;
      if (params.systemPrompt !== undefined) agent.systemPrompt = params.systemPrompt;
      if (params.model !== undefined) agent.model = params.model;
      if (params.temperature !== undefined) agent.temperature = params.temperature;
      if (params.openingMessage !== undefined) agent.openingMessage = params.openingMessage;
      if (params.contextLimit !== undefined) agent.contextLimit = params.contextLimit;
      if (params.status !== undefined) agent.status = params.status;
      agent.updatedAt = new Date().toISOString();
    }
    return { code: 0, message: 'ok', data: agent };
  });
}
