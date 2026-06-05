import type { AgentConfig } from '../agent-config';
import { registerMockHandler } from '../http';
import type { IActivity, IBadge, IFavoriteAgent, IPinnedAgent, IUserStats } from '../profile';

let registered = false;

const PINNED_KEY = 'minicoze_profile_pinned_agents';
const FAVORITES_KEY = 'minicoze_profile_favorite_agents';

const sampleAgents: AgentConfig[] = [
  {
    id: 'agent-001',
    name: 'AI 助手',
    avatar: '',
    description: '通用 AI 对话助手',
    mode: 'chat',
    persona: '',
    orchestration: '',
    createdAt: '2025-06-01T00:00:00Z',
    model: 'gpt-4o-mini',
    status: 'ACTIVE',
    workspaceId: 'default-workspace',
  },
  {
    id: 'agent-002',
    name: '代码审查助手',
    avatar: '',
    description: '帮助你检查代码质量和风格',
    mode: 'chat',
    persona: '',
    orchestration: '',
    createdAt: '2025-06-02T00:00:00Z',
    model: 'gpt-4o-mini',
    status: 'ACTIVE',
    workspaceId: 'default-workspace',
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage write failures in mock mode
  }
}

function getPinned(): IPinnedAgent[] {
  return readJson<IPinnedAgent[]>(PINNED_KEY, [
    { agentId: 'agent-001', pinnedAt: '2025-06-03T09:00:00Z' },
  ]);
}

function getFavoriteIds(): string[] {
  return readJson<string[]>(FAVORITES_KEY, ['agent-002']);
}

function toFavorite(agentId: string, index: number): IFavoriteAgent | null {
  const agent = sampleAgents.find((item) => item.id === agentId);
  if (!agent) return null;

  return {
    id: `favorite-${agentId}`,
    agentId,
    agent,
    favoritedAt: new Date(Date.now() - index * 86400000).toISOString(),
  };
}

export function setupProfileMocks() {
  if (registered) return;
  registered = true;

  registerMockHandler('GET', 'profile/stats', async () => {
    const data: IUserStats = {
      fans: 128,
      likes: 356,
      conversations: 1892,
      agentsCreated: sampleAgents.length,
      satisfaction: 96,
      monthlyEarnings: 128000,
    };
    return { code: 0, message: 'ok', data };
  });

  registerMockHandler('GET', 'profile/badges', async () => {
    const data: IBadge[] = [
      { id: 'badge-fire', name: '周榜达人', icon: 'fire', color: '#f5222d' },
      { id: 'badge-crown', name: '优质开发者', icon: 'crown', color: '#faad14' },
      { id: 'badge-rise', name: '新人之星', icon: 'rise', color: '#52c41a' },
    ];
    return { code: 0, message: 'ok', data };
  });

  registerMockHandler('GET', 'profile/favorites', async () => {
    const data = getFavoriteIds()
      .map(toFavorite)
      .filter((item): item is IFavoriteAgent => item !== null);
    return { code: 0, message: 'ok', data };
  });

  registerMockHandler('POST', 'profile/favorites', async (_body, _headers, path) => {
    const agentId = path.split('/').pop() ?? '';
    const next = Array.from(new Set([...getFavoriteIds(), agentId]));
    writeJson(FAVORITES_KEY, next);
    return { code: 0, message: 'ok', data: null };
  });

  registerMockHandler('DELETE', 'profile/favorites', async (_body, _headers, path) => {
    const agentId = path.split('/').pop() ?? '';
    writeJson(FAVORITES_KEY, getFavoriteIds().filter((id) => id !== agentId));
    return { code: 0, message: 'ok', data: null };
  });

  registerMockHandler('GET', 'profile/activities', async (_body, _headers, path) => {
    const page = Number(new URLSearchParams(path.split('?')[1] ?? '').get('page') ?? '1');
    const all: IActivity[] = [
      { id: 'activity-001', type: 'agent_created', content: '创建了 AI 助手', targetId: 'agent-001', createdAt: '2025-06-03T08:00:00Z' },
      { id: 'activity-002', type: 'agent_favorited', content: '收藏了代码审查助手', targetId: 'agent-002', createdAt: '2025-06-03T09:30:00Z' },
      { id: 'activity-003', type: 'badge_earned', content: '获得周榜达人徽章', createdAt: '2025-06-04T11:20:00Z' },
      { id: 'activity-004', type: 'milestone', content: '总对话数突破 1000 次', createdAt: '2025-06-05T15:45:00Z' },
    ];
    const pageSize = 3;
    const list = all.slice((page - 1) * pageSize, page * pageSize);
    return { code: 0, message: 'ok', data: { list, total: all.length } };
  });

  registerMockHandler('GET', 'profile/pinned-agents', async () => ({
    code: 0,
    message: 'ok',
    data: getPinned(),
  }));

  registerMockHandler('POST', 'profile/pinned-agents', async (_body, _headers, path) => {
    const agentId = path.split('/').pop() ?? '';
    const next = [
      { agentId, pinnedAt: new Date().toISOString() },
      ...getPinned().filter((item) => item.agentId !== agentId),
    ];
    writeJson(PINNED_KEY, next);
    return { code: 0, message: 'ok', data: null };
  });

  registerMockHandler('DELETE', 'profile/pinned-agents', async (_body, _headers, path) => {
    const agentId = path.split('/').pop() ?? '';
    writeJson(PINNED_KEY, getPinned().filter((item) => item.agentId !== agentId));
    return { code: 0, message: 'ok', data: null };
  });
}
