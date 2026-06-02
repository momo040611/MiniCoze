import type { AgentPublishSnapshot } from './types/publish.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseAgentPublishSnapshot(
  value: unknown,
): AgentPublishSnapshot | null {
  if (!isRecord(value) || !isRecord(value.agent)) {
    return null;
  }

  const agent = value.agent;
  if (
    typeof agent.id !== 'string' ||
    typeof agent.workspaceId !== 'string' ||
    typeof agent.name !== 'string' ||
    typeof agent.systemPrompt !== 'string' ||
    typeof agent.model !== 'string' ||
    typeof agent.temperature !== 'number' ||
    typeof agent.contextLimit !== 'number'
  ) {
    return null;
  }

  if (
    !Array.isArray(value.workflows) ||
    !Array.isArray(value.plugins) ||
    !Array.isArray(value.channels)
  ) {
    return null;
  }

  return value as unknown as AgentPublishSnapshot;
}
