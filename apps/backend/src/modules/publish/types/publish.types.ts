import {
  PublishAction,
  PublishActionStatus,
  PublishChannelType,
} from '@prisma/client';
import type { ToolDefinition } from '../../../shared/types/agent';

export interface PublishCheckItem {
  key: string;
  label: string;
  passed: boolean;
  message?: string;
}

export interface PublishCheckResponse {
  passed: boolean;
  items: PublishCheckItem[];
}

export interface PublishAgentResponse {
  versionId: string;
  version: number;
  publishedAt: string;
}

export interface AgentVersionListItem {
  id: string;
  version: number;
  changelog: string | null;
  isCurrent: boolean;
  publishedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    username: string;
  };
}

export interface PublishRecordListItem {
  id: string;
  action: PublishAction;
  status: PublishActionStatus;
  versionId: string | null;
  version: number | null;
  versionNumber: number | null;
  reason: string | null;
  changelog: string | null;
  errorMessage: string | null;
  operatorId: string;
  operatorName: string;
  createdAt: string;
  operator: {
    id: string;
    username: string;
  };
}

export interface RollbackAgentResponse {
  currentVersionId: string;
  version: number;
  rolledBackAt: string;
}

export interface OfflineAgentResponse {
  versionId: string | null;
  version: number | null;
  offlineAt: string;
}

export interface AgentPublishSnapshot {
  agent: {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    systemPrompt: string;
    model: string;
    temperature: number;
    openingMessage: string | null;
    contextLimit: number;
  };
  workflows: Array<{
    bindingId: string;
    workflowId: string;
    workflowVersionId: string;
    enabled: boolean;
  }>;
  plugins: Array<{
    bindingId: string;
    pluginId: string;
    pluginCode: string;
    status: string;
    autoInvoke: boolean;
    sortOrder: number;
    config: unknown;
    tools?: ToolDefinition[];
  }>;
  channels: Array<{
    channel: PublishChannelType;
    enabled: boolean;
    config: unknown;
  }>;
}
