import { AgentStatus } from '@prisma/client';

export interface AgentPluginBindingSummary {
  bindingId: string;
  pluginId: string;
  code: string;
  name: string;
  type: 'BUILTIN' | 'HTTP';
  status: 'ACTIVE' | 'DISABLED';
  autoInvoke: boolean;
  sortOrder: number;
}

export interface AgentResponse {
  id: string;
  workspaceId: string;
  creatorId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  systemPrompt: string;
  model: string;
  temperature: number;
  openingMessage: string | null;
  contextLimit: number;
  status: AgentStatus;
  plugins?: AgentPluginBindingSummary[];
  createdAt: string;
  updatedAt: string;
}
