import { getAgentList, type AgentConfig } from './agent-config';
import { http, type ApiEnvelope } from './http';

export interface IUserStats {
  fans: number;
  likes: number;
  conversations: number;
  agentsCreated: number;
  satisfaction: number;
  monthlyEarnings: number;
}

export interface IBadge {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface IFavoriteAgent {
  id: string;
  agentId: string;
  agent: AgentConfig;
  favoritedAt: string;
}

export interface IActivity {
  id: string;
  type: 'agent_created' | 'agent_favorited' | 'milestone' | 'badge_earned';
  content: string;
  targetId?: string;
  createdAt: string;
}

export interface IPinnedAgent {
  agentId: string;
  pinnedAt: string;
}

const PINNED_KEY = 'minicoze_profile_pinned_agents';
const FAVORITES_KEY = 'minicoze_profile_favorite_agents';

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
    // ignore local persistence failures
  }
}

function readPinnedAgents(): IPinnedAgent[] {
  return readJson<IPinnedAgent[]>(PINNED_KEY, []);
}

function readFavoriteAgentIds(): string[] {
  return readJson<string[]>(FAVORITES_KEY, []);
}

async function getAgentListOrEmpty(): Promise<AgentConfig[]> {
  try {
    return await getAgentList();
  } catch {
    return [];
  }
}

export async function getUserStats(): Promise<IUserStats> {
  try {
    const res = await http.get<ApiEnvelope<IUserStats>>('profile/stats');
    return res.data;
  } catch {
    const agents = await getAgentListOrEmpty();
    return {
      fans: 0,
      likes: 0,
      conversations: 0,
      agentsCreated: agents.length,
      satisfaction: 0,
      monthlyEarnings: 0,
    };
  }
}

export async function getUserBadges(): Promise<IBadge[]> {
  try {
    const res = await http.get<ApiEnvelope<IBadge[]>>('profile/badges');
    return res.data;
  } catch {
    return [];
  }
}

export async function getFavoriteAgents(): Promise<IFavoriteAgent[]> {
  try {
    const res = await http.get<ApiEnvelope<IFavoriteAgent[]>>('profile/favorites');
    return res.data;
  } catch {
    const [agents, favoriteIds] = await Promise.all([
      getAgentListOrEmpty(),
      Promise.resolve(readFavoriteAgentIds()),
    ]);
    const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
    return favoriteIds.flatMap((agentId, index) => {
      const agent = agentMap.get(agentId);
      if (!agent) return [];

      return {
        id: `local-favorite-${agentId}`,
        agentId,
        agent,
        favoritedAt: new Date(Date.now() - index * 1000).toISOString(),
      };
    });
  }
}

export async function getUserActivities(page = 1): Promise<{ list: IActivity[]; total: number }> {
  try {
    const res = await http.get<ApiEnvelope<{ list: IActivity[]; total: number }>>('profile/activities', {
      query: { page },
    });
    return res.data;
  } catch {
    return { list: [], total: 0 };
  }
}

export async function pinAgent(agentId: string): Promise<void> {
  try {
    await http.post<ApiEnvelope<unknown>>(`profile/pinned-agents/${agentId}`);
  } catch {
    const next = [
      { agentId, pinnedAt: new Date().toISOString() },
      ...readPinnedAgents().filter((item) => item.agentId !== agentId),
    ];
    writeJson(PINNED_KEY, next);
  }
}

export async function unpinAgent(agentId: string): Promise<void> {
  try {
    await http.delete<ApiEnvelope<unknown>>(`profile/pinned-agents/${agentId}`);
  } catch {
    writeJson(PINNED_KEY, readPinnedAgents().filter((item) => item.agentId !== agentId));
  }
}

export async function getPinnedAgents(): Promise<IPinnedAgent[]> {
  try {
    const res = await http.get<ApiEnvelope<IPinnedAgent[]>>('profile/pinned-agents');
    return res.data;
  } catch {
    return readPinnedAgents();
  }
}

export async function favoriteAgent(agentId: string): Promise<void> {
  try {
    await http.post<ApiEnvelope<unknown>>(`profile/favorites/${agentId}`);
  } catch {
    writeJson(FAVORITES_KEY, Array.from(new Set([...readFavoriteAgentIds(), agentId])));
  }
}

export async function unfavoriteAgent(agentId: string): Promise<void> {
  try {
    await http.delete<ApiEnvelope<unknown>>(`profile/favorites/${agentId}`);
  } catch {
    writeJson(FAVORITES_KEY, readFavoriteAgentIds().filter((id) => id !== agentId));
  }
}

export { setupProfileMocks } from './profile/setup-mocks';
