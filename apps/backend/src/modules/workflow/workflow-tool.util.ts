import type { ToolDefinition } from '../../shared/types/agent';

export const WORKFLOW_TOOL_NAME_PREFIX = '__workflow__';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function buildWorkflowToolName(workflowVersionId: string): string {
  return `${WORKFLOW_TOOL_NAME_PREFIX}${workflowVersionId}`;
}

export function isWorkflowToolName(functionName: string): boolean {
  return functionName.startsWith(WORKFLOW_TOOL_NAME_PREFIX);
}

export function parseWorkflowToolName(functionName: string): string | null {
  if (!isWorkflowToolName(functionName)) {
    return null;
  }

  const workflowVersionId = functionName.slice(
    WORKFLOW_TOOL_NAME_PREFIX.length,
  );
  return workflowVersionId.length > 0 ? workflowVersionId : null;
}

export function buildWorkflowToolDefinition(input: {
  workflowVersionId: string;
  workflowName: string;
  workflowDescription?: string | null;
  inputSchema?: Record<string, unknown> | null;
}): ToolDefinition {
  const description = input.workflowDescription?.trim()
    ? `${input.workflowName}: ${input.workflowDescription.trim()}`
    : `Run workflow ${input.workflowName}`;

  return {
    type: 'function',
    function: {
      name: buildWorkflowToolName(input.workflowVersionId),
      description,
      parameters: normalizeWorkflowInputSchema(input.inputSchema),
    },
  };
}

function normalizeWorkflowInputSchema(
  inputSchema?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (isRecord(inputSchema)) {
    return inputSchema;
  }

  return {
    type: 'object',
    properties: {},
    additionalProperties: true,
  };
}
