import type { PluginDefinition, PluginTool, Prisma } from '@prisma/client';
import type { RuntimeToolMetadata } from '../../../shared/types/agent';

export const PLUGIN_TYPE_VALUES = ['BUILTIN', 'HTTP'] as const;
export type PluginTypeValue = (typeof PLUGIN_TYPE_VALUES)[number];

export const PLUGIN_STATUS_VALUES = [
  'DRAFT',
  'ACTIVE',
  'DISABLED',
  'ARCHIVED',
] as const;
export type PluginStatusValue = (typeof PLUGIN_STATUS_VALUES)[number];

export const PLUGIN_TOOL_STATUS_VALUES = ['ACTIVE', 'DISABLED'] as const;
export type PluginToolStatusValue = (typeof PLUGIN_TOOL_STATUS_VALUES)[number];

export const AGENT_PLUGIN_BINDING_STATUS_VALUES = [
  'ACTIVE',
  'DISABLED',
] as const;
export type AgentPluginBindingStatusValue =
  (typeof AGENT_PLUGIN_BINDING_STATUS_VALUES)[number];

export const PLUGIN_CREDENTIAL_STATUS_VALUES = ['ACTIVE', 'DISABLED'] as const;
export type PluginCredentialStatusValue =
  (typeof PLUGIN_CREDENTIAL_STATUS_VALUES)[number];

export const PLUGIN_AUTH_TYPE_VALUES = ['none', 'api_key', 'oauth2'] as const;
export type PluginAuthTypeValue = (typeof PLUGIN_AUTH_TYPE_VALUES)[number];

export interface AgentPluginBindingConfig {
  disabledTools?: string[];
  defaults?: Record<string, Record<string, Prisma.JsonValue>>;
  forcedOverrides?: Record<string, Record<string, Prisma.JsonValue>>;
}

export interface PluginMaskRule {
  maskPaths?: string[];
  dropPaths?: string[];
  maxStringLength?: number;
}

export interface PluginMaskStrategy {
  enabled?: boolean;
  input?: PluginMaskRule;
  output?: PluginMaskRule;
  error?: {
    maxStringLength?: number;
  };
}

export interface PluginToolResponse {
  id: string;
  code: string;
  name: string;
  description: string;
  status: PluginToolStatusValue;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PluginDetailResponse {
  id: string;
  workspaceId: string;
  creatorId: string;
  code: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  type: PluginTypeValue;
  status: PluginStatusValue;
  version: string;
  isBuiltin: boolean;
  invocationEnabled: boolean;
  maskStrategy: Record<string, unknown> | null;
  tools: PluginToolResponse[];
  credentialSummary?: {
    count: number;
    activeCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AgentPluginBindingResponse {
  bindingId: string;
  agentId: string;
  pluginId: string;
  code: string;
  name: string;
  type: PluginTypeValue;
  status: AgentPluginBindingStatusValue;
  autoInvoke: boolean;
  sortOrder: number;
  config: AgentPluginBindingConfig | null;
  createdAt: string;
  updatedAt: string;
}

export interface PluginInvocationResponse {
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

export interface PluginToolTestResponse {
  success: boolean;
  output: unknown;
  error: string | null;
  durationMs: number;
}

export type AgentPluginBindingWithPluginAndTools =
  Prisma.AgentPluginBindingGetPayload<{
    include: {
      plugin: {
        include: {
          tools: true;
        };
      };
    };
  }>;

export type PluginWithTools = AgentPluginBindingWithPluginAndTools['plugin'];
export type PluginToolEntity = PluginWithTools['tools'][number];

export interface ResolvedPluginTool {
  binding: AgentPluginBindingWithPluginAndTools;
  plugin: PluginWithTools;
  tool: PluginToolEntity;
  metadata: Required<
    Pick<
      RuntimeToolMetadata,
      'toolKind' | 'pluginId' | 'pluginCode' | 'toolCode'
    >
  >;
}

export type PluginEntityForToolTest = Pick<
  PluginDefinition,
  'id' | 'code' | 'type' | 'maskStrategy'
>;

export type PluginToolEntityForToolTest = Pick<
  PluginTool,
  'code' | 'inputSchema' | 'meta'
>;

export type PluginInvocationTarget =
  | Pick<ResolvedPluginTool, 'plugin' | 'tool'>
  | { plugin: PluginEntityForToolTest; tool: PluginToolEntityForToolTest };
