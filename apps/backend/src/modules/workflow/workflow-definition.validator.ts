export interface WorkflowNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  // 容器节点（如 loop）的内部子节点与子图连线。
  blocks?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

export interface WorkflowEdge {
  source: string;
  target: string;
  // 出口端口：分支节点（selector）靠它区分不同分支走向。
  sourcePort?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowDefinitionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringSet(values: string[]): Set<string> {
  const result = new Set<string>();
  for (const value of values) {
    result.add(value);
  }
  return result;
}

export function parseWorkflowDefinition(
  input: unknown,
): WorkflowDefinition | null {
  if (!isRecord(input)) {
    return null;
  }

  const nodesRaw = input.nodes;
  const edgesRaw = input.edges;
  if (!Array.isArray(nodesRaw) || !Array.isArray(edgesRaw)) {
    return null;
  }

  return {
    nodes: nodesRaw.map(normalizeNode),
    edges: edgesRaw.map(normalizeEdge),
  };
}

function normalizeNode(raw: unknown): WorkflowNode {
  if (!isRecord(raw)) {
    return {
      id: '',
      type: '',
    };
  }

  const node: WorkflowNode = {
    id: typeof raw.id === 'string' ? raw.id : '',
    type: typeof raw.type === 'string' ? raw.type : '',
    data: normalizeNodeData(raw.data),
  };

  // 容器节点（loop/batch 等）保留其内部子图，供 runner 递归执行。
  if (Array.isArray(raw.blocks)) {
    node.blocks = raw.blocks.map(normalizeNode);
  }
  if (Array.isArray(raw.edges)) {
    node.edges = raw.edges.map(normalizeEdge);
  }

  return node;
}

function normalizeNodeData(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const normalized: Record<string, unknown> = { ...raw };
  const inputs = isRecord(raw.inputs) ? raw.inputs : undefined;

  // 兼容 Coze Canvas 数据：
  // data.inputs 里通常承载节点运行参数，这里做一层字段提升，
  // 让当前基础执行器无需感知两种不同协议。
  if (inputs) {
    normalized.inputs = inputs;
    const maybeLiftKeys = [
      'prompt',
      'systemPrompt',
      'model',
      'temperature',
      'maxTokens',
    ];
    for (const key of maybeLiftKeys) {
      if (normalized[key] === undefined && inputs[key] !== undefined) {
        normalized[key] = inputs[key];
      }
    }
  }

  return normalized;
}

function normalizeEdge(raw: unknown): WorkflowEdge {
  if (!isRecord(raw)) {
    return {
      source: '',
      target: '',
    };
  }

  // 兼容两种边定义：
  // 1) MiniCoze 当前定义: { source, target }
  // 2) Coze Canvas 定义: { sourceNodeID, targetNodeID }
  const source =
    typeof raw.source === 'string'
      ? raw.source
      : typeof raw.sourceNodeID === 'string'
        ? raw.sourceNodeID
        : '';
  const target =
    typeof raw.target === 'string'
      ? raw.target
      : typeof raw.targetNodeID === 'string'
        ? raw.targetNodeID
        : '';

  // 兼容端口字段：sourcePort（内部）/ sourcePortID（Coze Canvas）。
  const sourcePort =
    typeof raw.sourcePort === 'string'
      ? raw.sourcePort
      : typeof raw.sourcePortID === 'string'
        ? raw.sourcePortID
        : undefined;

  return {
    source,
    target,
    ...(sourcePort ? { sourcePort } : {}),
  };
}

export function validateWorkflowDefinition(
  input: unknown,
): WorkflowDefinitionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const definition = parseWorkflowDefinition(input);

  if (!definition) {
    return {
      valid: false,
      errors: ['工作流定义无效：必须包含 nodes[] 和 edges[]'],
      warnings,
      nodeCount: 0,
      edgeCount: 0,
    };
  }

  const { nodes, edges } = definition;
  if (nodes.length === 0) {
    errors.push('工作流至少需要 1 个节点');
  }

  const nodeIdList: string[] = [];
  let startCount = 0;
  let endCount = 0;
  for (const node of nodes) {
    if (!isRecord(node)) {
      errors.push('节点格式错误：节点必须为对象');
      continue;
    }

    const nodeId = node.id;
    const nodeType = node.type;
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      errors.push('节点格式错误：node.id 必须是非空字符串');
      continue;
    }
    if (typeof nodeType !== 'string' || nodeType.length === 0) {
      errors.push(`节点 ${nodeId} 格式错误：node.type 必须是非空字符串`);
      continue;
    }

    nodeIdList.push(nodeId);
    if (nodeType === 'start') {
      startCount += 1;
    }
    if (nodeType === 'end') {
      endCount += 1;
    }
  }

  const nodeIdSet = toStringSet(nodeIdList);
  if (nodeIdSet.size !== nodeIdList.length) {
    errors.push('节点格式错误：存在重复的 node.id');
  }
  if (startCount === 0) {
    errors.push('工作流必须包含 1 个 start 节点');
  }
  if (startCount > 1) {
    errors.push('工作流只能包含 1 个 start 节点');
  }
  if (endCount === 0) {
    errors.push('工作流必须至少包含 1 个 end 节点');
  }

  for (const edge of edges) {
    if (!isRecord(edge)) {
      errors.push('连线格式错误：edge 必须是对象');
      continue;
    }
    const source = edge.source;
    const target = edge.target;
    if (typeof source !== 'string' || typeof target !== 'string') {
      errors.push('连线格式错误：edge.source 与 edge.target 必须是字符串');
      continue;
    }
    if (!nodeIdSet.has(source)) {
      errors.push(`连线格式错误：source 节点不存在 (${source})`);
    }
    if (!nodeIdSet.has(target)) {
      errors.push(`连线格式错误：target 节点不存在 (${target})`);
    }
  }

  if (edges.length === 0 && nodes.length > 1) {
    warnings.push('当前工作流没有连线，运行时将只执行简化逻辑');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}
