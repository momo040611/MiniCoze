import type { WorkflowCanvasData } from '../../../api/workflows';
import type {
  ConditionBranch,
  ConditionConfig,
  EndConfig,
  LLMConfig,
  NodeMeta,
  VariableInfo,
} from '../nodeRenders/types';

type NodeConfig = LLMConfig & EndConfig & ConditionConfig & Record<string, unknown>;

type WorkflowJsonNode = {
  id?: string;
  type?: string;
  data?: {
    nodeMeta?: Partial<NodeMeta>;
    inputs?: Partial<VariableInfo>[];
    outputs?: Partial<VariableInfo>[];
    config?: NodeConfig;
  };
  [key: string]: unknown;
};

export type NodeValidationError = {
  nodeId: string;
  nodeTitle: string;
  field: string;
  message: string;
};

const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CONDITION_OPERATORS = new Set([
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'gt',
  'gte',
  'lt',
  'lte',
  'empty',
  'notEmpty',
]);

function asNode(node: unknown): WorkflowJsonNode {
  return (node ?? {}) as WorkflowJsonNode;
}

export function getWorkflowNodeId(node: unknown) {
  const jsonNode = asNode(node);
  return String(jsonNode.id ?? '');
}

function getNodeTitle(node: WorkflowJsonNode) {
  return node.data?.nodeMeta?.title?.trim() || `${node.type ?? 'unknown'} 节点`;
}

function normalizeType(type?: string) {
  if (type === 'input') return 'start';
  if (type === 'output') return 'end';
  if (type === 'selector') return 'condition';
  return type ?? 'unknown';
}

function isBlank(value: unknown) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function addError(
  errors: NodeValidationError[],
  node: WorkflowJsonNode,
  field: string,
  message: string,
) {
  errors.push({
    nodeId: getWorkflowNodeId(node),
    nodeTitle: getNodeTitle(node),
    field,
    message,
  });
}

function validateVariables(
  errors: NodeValidationError[],
  node: WorkflowJsonNode,
  fieldName: 'inputs' | 'outputs',
) {
  const variables = Array.isArray(node.data?.[fieldName]) ? node.data[fieldName] : [];
  const usedNames = new Set<string>();
  const label = fieldName === 'inputs' ? '输入变量' : '输出变量';

  variables.forEach((variable, index) => {
    const prefix = `${label} ${index + 1}`;
    const name = variable.name?.trim() ?? '';

    if (isBlank(variable.label)) {
      addError(errors, node, `${fieldName}.${index}.label`, `${prefix}的显示名不能为空`);
    }

    if (!name) {
      addError(errors, node, `${fieldName}.${index}.name`, `${prefix}的变量名不能为空`);
    } else if (!VARIABLE_NAME_PATTERN.test(name)) {
      addError(errors, node, `${fieldName}.${index}.name`, `${prefix}只能使用字母、数字和下划线，且不能以数字开头`);
    } else if (usedNames.has(name)) {
      addError(errors, node, `${fieldName}.${index}.name`, `${prefix}的变量名重复`);
    }

    if (name && VARIABLE_NAME_PATTERN.test(name)) {
      usedNames.add(name);
    }

    if (isBlank(variable.type)) {
      addError(errors, node, `${fieldName}.${index}.type`, `${prefix}的类型不能为空`);
    }
  });
}

function validateConditionConfig(
  errors: NodeValidationError[],
  node: WorkflowJsonNode,
  config: NodeConfig,
) {
  const branches = Array.isArray(config.branches) ? config.branches : [];

  if (branches.length === 0) {
    addError(errors, node, 'config.branches', '条件节点至少需要一个条件分支');
    return;
  }

  const usedPorts = new Set<string>();

  branches.forEach((branch: ConditionBranch, branchIndex) => {
    const branchPrefix = `分支 ${branchIndex + 1}`;
    const port = branch.port?.trim() ?? '';

    if (!port) {
      addError(errors, node, `config.branches.${branchIndex}.port`, `${branchPrefix}出口端口不能为空`);
    } else if (usedPorts.has(port)) {
      addError(errors, node, `config.branches.${branchIndex}.port`, `${branchPrefix}出口端口不能重复`);
    }

    if (port) {
      usedPorts.add(port);
    }

    const conditions = Array.isArray(branch.conditions) ? branch.conditions : [];
    if (conditions.length === 0) {
      addError(errors, node, `config.branches.${branchIndex}.conditions`, `${branchPrefix}至少需要一条条件`);
      return;
    }

    conditions.forEach((condition, conditionIndex) => {
      const conditionPrefix = `${branchPrefix} 条件 ${conditionIndex + 1}`;
      const op = condition.op ?? '';

      if (isBlank(condition.left)) {
        addError(
          errors,
          node,
          `config.branches.${branchIndex}.conditions.${conditionIndex}.left`,
          `${conditionPrefix}左值不能为空`,
        );
      }

      if (!CONDITION_OPERATORS.has(op)) {
        addError(
          errors,
          node,
          `config.branches.${branchIndex}.conditions.${conditionIndex}.op`,
          `${conditionPrefix}判断方式不支持`,
        );
      }

      if (op !== 'empty' && op !== 'notEmpty' && isBlank(condition.right)) {
        addError(
          errors,
          node,
          `config.branches.${branchIndex}.conditions.${conditionIndex}.right`,
          `${conditionPrefix}右值不能为空`,
        );
      }
    });
  });

  if (isBlank(config.defaultPort)) {
    addError(errors, node, 'config.defaultPort', '默认出口端口不能为空');
  }
}

function isJsonArrayText(value: unknown) {
  if (Array.isArray(value)) {
    return true;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

function validateLoopConfig(
  errors: NodeValidationError[],
  node: WorkflowJsonNode,
  config: NodeConfig,
) {
  if (isBlank(config.items)) {
    addError(errors, node, 'config.items', '循环节点的循环数组不能为空');
  }

  if (
    config.concurrency !== undefined &&
    (typeof config.concurrency !== 'number' || config.concurrency < 1 || config.concurrency > 20)
  ) {
    addError(errors, node, 'config.concurrency', '循环节点并发数必须在 1 到 20 之间');
  }

  if (config.onError !== undefined && config.onError !== 'abort' && config.onError !== 'continue') {
    addError(errors, node, 'config.onError', '循环节点失败策略只能是 abort 或 continue');
  }

  if (!isJsonArrayText(config.blocks ?? config.blocksJson)) {
    addError(errors, node, 'config.blocksJson', '循环节点内部节点必须是 JSON 数组');
  }

  const edgesValue = config.edges ?? config.edgesJson;
  if (edgesValue !== undefined && edgesValue !== '' && !isJsonArrayText(edgesValue)) {
    addError(errors, node, 'config.edgesJson', '循环节点内部连线必须是 JSON 数组');
  }
}

export function validateNode(nodeInput: unknown): NodeValidationError[] {
  const node = asNode(nodeInput);
  const errors: NodeValidationError[] = [];
  const type = normalizeType(node.type);
  const config = node.data?.config ?? {};

  if (!getWorkflowNodeId(node)) {
    addError(errors, node, 'id', '节点 ID 缺失');
  }

  if (isBlank(node.data?.nodeMeta?.title)) {
    addError(errors, node, 'nodeMeta.title', '节点名称不能为空');
  }

  if (type !== 'start') {
    validateVariables(errors, node, 'inputs');
  }

  if (type !== 'end') {
    validateVariables(errors, node, 'outputs');
  }

  if (type === 'llm') {
    if (isBlank(config.model)) {
      addError(errors, node, 'config.model', '模型不能为空');
    }

    if (isBlank(config.prompt)) {
      addError(errors, node, 'config.prompt', 'Prompt 不能为空');
    }

    if (
      config.temperature !== undefined &&
      (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)
    ) {
      addError(errors, node, 'config.temperature', '温度必须在 0 到 2 之间');
    }
  }

  if (type === 'condition') {
    validateConditionConfig(errors, node, config);
  }

  if (type === 'loop') {
    validateLoopConfig(errors, node, config);
  }

  if (type === 'plugin') {
    if (isBlank(config.pluginId)) {
      addError(errors, node, 'config.pluginId', '插件 ID 不能为空');
    }

    if (isBlank(config.action)) {
      addError(errors, node, 'config.action', '调用动作不能为空');
    }
  }

  if (type === 'database') {
    if (isBlank(config.source)) {
      addError(errors, node, 'config.source', '数据源不能为空');
    }

    if (isBlank(config.query)) {
      addError(errors, node, 'config.query', '查询语句不能为空');
    }
  }

  if (type === 'end' && isBlank(config.outputMode)) {
    addError(errors, node, 'config.outputMode', '输出方式不能为空');
  }

  return errors;
}

export function validateWorkflow(canvasData?: WorkflowCanvasData | null): NodeValidationError[] {
  if (!canvasData?.nodes?.length) {
    return [];
  }

  return canvasData.nodes.flatMap((node) => validateNode(node));
}

export function groupValidationErrorsByNodeId(errors: NodeValidationError[]) {
  return errors.reduce<Record<string, NodeValidationError[]>>((result, error) => {
    if (!result[error.nodeId]) {
      result[error.nodeId] = [];
    }

    result[error.nodeId].push(error);
    return result;
  }, {});
}
