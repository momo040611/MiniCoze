
import { API_BASE_URL, getAuthToken, http, type ApiEnvelope } from '../http';

export interface WorkflowCanvasData {
  nodes: unknown[];
  edges: unknown[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}
export type WorkflowDefinition = WorkflowCanvasData;
export interface Workflow {
  id: string;
  workspaceId?: string;
  name: string;
  description?: string | null;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  canvasData?: WorkflowCanvasData;
  createdAt: string;
  updatedAt: string;
}
export interface WorkflowResponseLike extends Workflow {
  draftDefinition?: WorkflowDefinition | null;
}

export interface CreateWorkflowParams {
  workspaceId?: string;
  name: string;
  description?: string | null;
  canvasData?: WorkflowCanvasData;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string | null;
}

export interface RunWorkflowRequest {
  input?: Record<string, unknown>;
  version?: number;
}

export type WorkflowRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export type WorkflowRunNodeStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

export interface WorkflowRunNode {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: WorkflowRunNodeStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunResult {
  id: string;
  workflowId: string;
  workflowVersionId: string | null;
  workspaceId: string;
  startedBy: string;
  status: WorkflowRunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  nodes?: WorkflowRunNode[];
}

export type WorkflowStreamEvent =
  | {
      type: 'run.created';
      runId: string;
    }
  | {
      type: 'node.started';
      runId?: string;
      nodeId: string;
      nodeType: string;
      input?: Record<string, unknown>;
    }
  | {
      type: 'node.completed';
      runId?: string;
      nodeId: string;
      nodeType: string;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
      durationMs?: number;
    }
  | {
      type: 'node.failed';
      runId?: string;
      nodeId: string;
      nodeType: string;
      input?: Record<string, unknown>;
      errorMessage?: string;
      durationMs?: number;
    }
  | {
      type: 'run.completed';
      runId: string;
      output?: Record<string, unknown>;
    }
  | {
      type: 'run.failed';
      runId: string;
      errorMessage?: string;
      error?: string;
    }
  | {
      type: 'stream.done';
      runId: string;
    };

export interface PaginatedWorkflowResponse {
  list: WorkflowResponseLike[];
  total: number;
  page: number;
  pageSize: number;
}

const STORAGE_KEY = 'miniCoze_workflows';

export const DEFAULT_WORKFLOW_CANVAS_DATA: WorkflowCanvasData = {
  nodes: [
    {
      id: 'start_1',
      type: 'start',
      meta: {
        position: { x: 120, y: 230 },
      },
      data: {
        nodeMeta: {
          title: '开始节点',
        },
        outputs: [
          {
            label: '输出',
            type: 'string',
            name: 'query',
          },
        ],
      },
    },
    {
      id: 'end_1',
      type: 'end',
      meta: {
        position: { x: 500, y: 230 },
      },
      data: {
        nodeMeta: {
          title: '结束节点',
        },
        inputs: [
          {
            label: '输入',
            type: 'string',
            name: 'query',
          },
        ],
      },
    },
  ],
  edges: [
    {
      sourceNodeID: 'start_1',
      targetNodeID: 'end_1',
    },
  ],
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
};
/**
 * 字段映射关系：
 *
 * 前端 CreateWorkflowParams -> 后端 POST /api/workflows body
 * - workspaceId -> workspaceId
 * - name -> name
 * - description -> description
 * - canvasData -> definition
 *
 * 后端 WorkflowResponse -> 前端 Workflow
 * - draftDefinition -> canvasData
 * - description -> description
 * - status -> status
 * - createdAt -> createdAt
 * - updatedAt -> updatedAt
 */
export function toWorkflowDefinition(
  canvasData?: WorkflowCanvasData,
): WorkflowDefinition {
  return normalizeWorkflowCanvasData(canvasData);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRecordOrEmpty(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeWorkflowEdge(edge: unknown) {
  const record = toRecordOrEmpty(edge);
  const sourceNodeID = record.sourceNodeID ?? record.source;
  const targetNodeID = record.targetNodeID ?? record.target;

  return {
    ...record,
    sourceNodeID,
    targetNodeID,
    source: record.source ?? sourceNodeID,
    target: record.target ?? targetNodeID,
  };
}

function getDefaultNodeData(type: string, index: number) {
  if (type === 'start') {
    return {
      nodeMeta: { title: '开始节点' },
      outputs: [{ label: '输出', type: 'string', name: 'query' }],
    };
  }

  if (type === 'end') {
    return {
      nodeMeta: { title: '结束节点' },
      inputs: [{ label: '输入', type: 'string', name: 'content' }],
      config: { outputMode: '返回变量' },
    };
  }

  if (type === 'llm') {
    return {
      nodeMeta: { title: '大模型节点' },
      inputs: [{ label: '输入', type: 'string', name: 'query' }],
      outputs: [{ label: '输出', type: 'string', name: 'content' }],
      config: {
        model: 'deepseek-chat',
        temperature: 0.7,
        systemPrompt: '你是一个简洁、可靠的助手。',
        prompt: '请回答用户问题：{{input.query}}',
      },
    };
  }

  return {
    nodeMeta: { title: `${type || '节点'}_${index + 1}` },
  };
}

function normalizeWorkflowNode(node: unknown, index: number) {
  const record = toRecordOrEmpty(node);
  const type = typeof record.type === 'string' && record.type ? record.type : 'llm';
  const id = typeof record.id === 'string' && record.id ? record.id : `${type}_${index + 1}`;
  const meta = toRecordOrEmpty(record.meta);
  const data = toRecordOrEmpty(record.data);
  const defaultData = getDefaultNodeData(type, index);
  const dataInputs = Array.isArray(data.inputs) ? data.inputs : undefined;
  const dataOutputs = Array.isArray(data.outputs) ? data.outputs : undefined;
  const runnableInputs = Array.isArray(data.inputs) ? {} : toRecordOrEmpty(data.inputs);

  return {
    ...record,
    id,
    type,
    meta: {
      ...meta,
      position: isRecord(meta.position)
        ? meta.position
        : { x: 120 + index * 360, y: 230 },
    },
    data: {
      ...defaultData,
      ...data,
      inputs: dataInputs ?? defaultData.inputs ?? [],
      outputs: dataOutputs ?? defaultData.outputs ?? [],
      nodeMeta: {
        ...toRecordOrEmpty(defaultData.nodeMeta),
        ...toRecordOrEmpty(data.nodeMeta),
      },
      config: {
        ...toRecordOrEmpty(defaultData.config),
        ...runnableInputs,
        ...toRecordOrEmpty(data.config),
      },
    },
  };
}

export function normalizeWorkflowCanvasData(
  canvasData?: WorkflowCanvasData | null,
): WorkflowCanvasData {
  if (!canvasData || !Array.isArray(canvasData.nodes)) {
    return structuredClone(DEFAULT_WORKFLOW_CANVAS_DATA);
  }

  return {
    ...canvasData,
    nodes: canvasData.nodes.length
      ? canvasData.nodes.map(normalizeWorkflowNode)
      : structuredClone(DEFAULT_WORKFLOW_CANVAS_DATA.nodes),
    edges: Array.isArray(canvasData.edges)
      ? canvasData.edges.map(normalizeWorkflowEdge)
      : [],
    viewport: canvasData.viewport,
  };
}

function normalizeLlmPrompt(prompt: unknown) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return '请回答用户问题：{{input.query}}';
  }

  if (prompt.trim() === '请根据输入生成回答。') {
    return '请回答用户问题：{{input.query}}';
  }

  return prompt;
}

export function toRunnableWorkflowDefinition(
  canvasData?: WorkflowCanvasData,
): WorkflowDefinition {
  const definition = toWorkflowDefinition(canvasData);

  return {
    ...definition,
    nodes: definition.nodes.map((node) => {
      if (!isRecord(node)) {
        return node;
      }

      const data = toRecordOrEmpty(node.data);
      const config = toRecordOrEmpty(data.config);

      if (node.type !== 'llm') {
        return node;
      }

      return {
        ...node,
        data: {
          ...data,
          inputs: {
            ...toRecordOrEmpty(data.inputs),
            systemPrompt: config.systemPrompt,
            model: config.model,
            prompt: normalizeLlmPrompt(config.prompt),
            temperature: config.temperature,
            maxTokens: config.maxTokens,
          },
        },
      };
    }),
  };
}

export function fromWorkflowResponse(response: WorkflowResponseLike): Workflow {
  return {
    ...response,
    canvasData: normalizeWorkflowCanvasData(
      response.canvasData ?? response.draftDefinition,
    ),
  };
}
export interface CreateWorkflowRequest {
  workspaceId: string;
  name: string;
  description?: string | null;
  definition?: WorkflowDefinition;
}
export function toCreateWorkflowRequest(
  params: CreateWorkflowParams & { workspaceId: string },
): CreateWorkflowRequest {
  return {
    workspaceId: params.workspaceId,
    name: params.name,
    description: params.description,
    definition: toWorkflowDefinition(params.canvasData),
  };
}
function readWorkflows(): Workflow[] {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Workflow[];
  } catch {
    return [];
  }
}

function writeWorkflows(workflows: Workflow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getWorkflowList(): Promise<Workflow[]> {
  return readWorkflows().map(fromWorkflowResponse);
}

export async function getWorkflowListRemote(
  workspaceId: string,
): Promise<Workflow[]> {
  const res = await http.get<ApiEnvelope<PaginatedWorkflowResponse>>(
    'workflows',
    {
      query: {
        workspaceId,
        page: 1,
        pageSize: 100,
      },
    },
  );

  return res.data.list.map(fromWorkflowResponse);
}

export async function createWorkflow(params: CreateWorkflowParams): Promise<Workflow> {
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: createId(),
    workspaceId: params.workspaceId,
    name: params.name,
    description: params.description ?? null,
    status: 'DRAFT',
    canvasData: toWorkflowDefinition(params.canvasData),
    createdAt: now,
    updatedAt: now,
  };

  writeWorkflows([workflow, ...readWorkflows()]);

  return workflow;
}

export async function createWorkflowRemote(
  params: CreateWorkflowParams,
): Promise<Workflow> {
  if (!params.workspaceId) {
    throw new Error('workspaceId is required to create workflow remotely');
  }

  const res = await http.post<
    ApiEnvelope<WorkflowResponseLike>,
    CreateWorkflowRequest
  >('workflows', toCreateWorkflowRequest({
    ...params,
    workspaceId: params.workspaceId,
  }));

  return fromWorkflowResponse(res.data);
}

export async function getWorkflowById(id: string): Promise<Workflow | null> {
  const workflow = readWorkflows().find((item) => item.id === id);
  return workflow ? fromWorkflowResponse(workflow) : null;
}

export const getWorkflowDetail = getWorkflowById;

export async function getWorkflowByIdRemote(id: string): Promise<Workflow> {
  const res = await http.get<ApiEnvelope<WorkflowResponseLike>>(
    `workflows/${id}`,
  );

  return fromWorkflowResponse(res.data);
}

export async function updateWorkflow(
  id: string,
  patch: Partial<Workflow>,
): Promise<Workflow | null> {
  let updatedWorkflow: Workflow | null = null;
  const nextWorkflows = readWorkflows().map((item) => {
    if (item.id !== id) {
      return item;
    }

    updatedWorkflow = {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return updatedWorkflow;
  });

  writeWorkflows(nextWorkflows);

  return updatedWorkflow;
}

export async function updateWorkflowRemote(
  id: string,
  patch: UpdateWorkflowRequest,
): Promise<Workflow> {
  const res = await http.patch<
    ApiEnvelope<WorkflowResponseLike>,
    UpdateWorkflowRequest
  >(`workflows/${id}`, patch);

  return fromWorkflowResponse(res.data);
}

export async function deleteWorkflowRemote(id: string): Promise<Workflow> {
  const res = await http.delete<ApiEnvelope<WorkflowResponseLike>>(
    `workflows/${id}`,
  );

  return fromWorkflowResponse(res.data);
}

export async function saveWorkflowDraft(
  id: string,
  canvasData: WorkflowCanvasData,
): Promise<Workflow | null> {
  return updateWorkflow(id, {
    canvasData: toWorkflowDefinition(canvasData),
  });
}

export async function saveWorkflowDraftRemote(
  id: string,
  canvasData: WorkflowCanvasData,
): Promise<Workflow> {
  const res = await http.put<
    ApiEnvelope<WorkflowResponseLike>,
    { definition: WorkflowDefinition }
  >(`workflows/${id}/draft`, {
    definition: toWorkflowDefinition(canvasData),
  });

  return fromWorkflowResponse(res.data);
}

export async function runWorkflowRemote(
  workflowId: string,
  params: RunWorkflowRequest,
): Promise<WorkflowRunResult> {
  const res = await http.post<
    ApiEnvelope<WorkflowRunResult>,
    RunWorkflowRequest
  >(`workflows/${workflowId}/run`, params);

  return res.data;
}

function buildApiUrl(path: string) {
  return `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function parseWorkflowStreamChunk(chunk: string): WorkflowStreamEvent | null {
  const dataLines = chunk
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return JSON.parse(dataLines.join('\n')) as WorkflowStreamEvent;
}

export async function runWorkflowStreamRemote(
  workflowId: string,
  params: RunWorkflowRequest,
  onEvent: (event: WorkflowStreamEvent) => void,
): Promise<void> {
  const token = getAuthToken();
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(`workflows/${workflowId}/run/stream`), {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || response.statusText || '流式试运行请求失败');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? '';

    chunks.forEach((chunk) => {
      const event = parseWorkflowStreamChunk(chunk);

      if (event) {
        onEvent(event);
      }
    });
  }

  if (buffer.trim()) {
    const event = parseWorkflowStreamChunk(buffer);

    if (event) {
      onEvent(event);
    }
  }
}

export async function deleteWorkflow(id: string): Promise<void> {
  writeWorkflows(readWorkflows().filter((item) => item.id !== id));
}

export async function replaceAgentWorkflowBindings(
  agentId: string,
  bindings: Array<{
    workflowId: string;
    workflowVersionId?: string;
    enabled?: boolean;
  }>,
) {
  const response = await http.put<ApiEnvelope<unknown[]>>(
    `agents/${agentId}/workflows`,
    { bindings },
  );
  return response.data;
}
