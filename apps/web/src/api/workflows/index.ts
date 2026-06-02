
import { http, type ApiEnvelope } from '../http';

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
  return canvasData ?? structuredClone(DEFAULT_WORKFLOW_CANVAS_DATA);
}

export function fromWorkflowResponse(response: WorkflowResponseLike): Workflow {
  return {
    ...response,
    canvasData:
      response.canvasData ??
      response.draftDefinition ??
      structuredClone(DEFAULT_WORKFLOW_CANVAS_DATA),
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

export async function deleteWorkflow(id: string): Promise<void> {
  writeWorkflows(readWorkflows().filter((item) => item.id !== id));
}
