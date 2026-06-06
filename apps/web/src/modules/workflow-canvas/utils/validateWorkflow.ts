import type { WorkflowCanvasData } from '../../../api/workflows';
import type { EndConfig, LLMConfig, NodeMeta, VariableInfo } from '../nodeRenders/types';

type NodeConfig = LLMConfig & EndConfig & Record<string, unknown>;

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
    if (isBlank(config.operator)) {
      addError(errors, node, 'config.operator', '判断方式不能为空');
    }

    if (config.operator === 'expression') {
      if (isBlank(config.expression)) {
        addError(errors, node, 'config.expression', '自定义表达式不能为空');
      }
    } else if (isBlank(config.compareValue)) {
      addError(errors, node, 'config.compareValue', '比较值不能为空');
    }
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
