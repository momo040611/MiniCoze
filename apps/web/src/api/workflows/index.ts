export interface WorkflowCanvasData {
  nodes: unknown[];
  edges: unknown[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}
export interface Workflow {
  id: string;
  workspaceId?: string;
  name: string;
  description?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  canvasData?: WorkflowCanvasData;
  createdAt: string;
  updatedAt: string;
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
  return readWorkflows();
}

export async function createWorkflow(params: {
  name: string;
  description?: string;
}): Promise<Workflow> {
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: createId(),
    name: params.name,
    description: params.description,
    status: 'DRAFT',
    canvasData: DEFAULT_WORKFLOW_CANVAS_DATA,
    createdAt: now,
    updatedAt: now,
  };

  writeWorkflows([workflow, ...readWorkflows()]);

  return workflow;
}

export async function getWorkflowDetail(id: string): Promise<Workflow | null> {
  return readWorkflows().find((item) => item.id === id) ?? null;
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

export async function deleteWorkflow(id: string): Promise<void> {
  writeWorkflows(readWorkflows().filter((item) => item.id !== id));
}
