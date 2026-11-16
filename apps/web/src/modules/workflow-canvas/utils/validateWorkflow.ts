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
      addError(errors, node, 'config.pluginId', '请选择插件');
    }

    if (isBlank(config.toolId)) {
      addError(errors, node, 'config.toolId', '请选择插件工具');
    }

    const argsJson = config.argsJson;
    if (typeof argsJson === 'string' && argsJson.trim()) {
      try {
        const parsed = JSON.parse(argsJson) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          addError(errors, node, 'config.argsJson', '入参必须是 JSON 对象');
        }
      } catch {
        addError(errors, node, 'config.argsJson', '入参 JSON 格式不正确');
      }
    }
  }

  if (type === 'knowledge') {
    const kbIds = config.knowledgeBaseIds;
    if (!Array.isArray(kbIds) || kbIds.length === 0) {
      addError(errors, node, 'config.knowledgeBaseIds', '请至少选择一个知识库');
    }

    if (isBlank(config.query)) {
      addError(errors, node, 'config.query', '检索问题不能为空');
    }

    if (config.topK !== undefined && (typeof config.topK !== 'number' || config.topK < 1 || config.topK > 20)) {
      addError(errors, node, 'config.topK', '召回条数必须在 1 到 20 之间');
    }
  }

  if (type === 'code') {
    if (isBlank(config.code)) {
      addError(errors, node, 'config.code', '代码不能为空');
    }

    const paramsJson = config.paramsJson;
    if (typeof paramsJson === 'string' && paramsJson.trim()) {
      try {
        const parsed = JSON.parse(paramsJson) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          addError(errors, node, 'config.paramsJson', '入参映射必须是 JSON 对象');
        }
      } catch {
        addError(errors, node, 'config.paramsJson', '入参映射 JSON 格式不正确');
      }
    }
  }

  if (type === 'http') {
    const url = config.url;
    if (isBlank(url)) {
      addError(errors, node, 'config.url', '请求地址不能为空');
    } else if (
      typeof url === 'string' &&
      !/^https?:\/\/.+/.test(url.trim()) &&
      !/\{\{.+?\}\}/.test(url)
    ) {
      addError(errors, node, 'config.url', '请求地址必须以 http:// 或 https:// 开头');
    }

    const headersJson = config.headersJson;
    if (typeof headersJson === 'string' && headersJson.trim()) {
      try {
        const parsed = JSON.parse(headersJson) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          addError(errors, node, 'config.headersJson', '请求头必须是 JSON 对象');
        }
      } catch {
        addError(errors, node, 'config.headersJson', '请求头 JSON 格式不正确');
      }
    }

    if (
      config.timeout !== undefined &&
      (typeof config.timeout !== 'number' || config.timeout < 1000 || config.timeout > 120000)
    ) {
      addError(errors, node, 'config.timeout', '超时时间必须在 1000 到 120000 毫秒之间');
    }
  }

  if (type === 'variable') {
    const name = config.name;
    if (isBlank(name)) {
      addError(errors, node, 'config.name', '变量名不能为空');
    } else if (typeof name === 'string' && !VARIABLE_NAME_PATTERN.test(name.trim())) {
      addError(errors, node, 'config.name', '变量名只能使用字母、数字和下划线，且不能以数字开头');
    }
  }

  if (type === 'end') {
    if (isBlank(config.outputMode)) {
      addError(errors, node, 'config.outputMode', '输出方式不能为空');
    }

    const outputFieldsJson = config.outputFieldsJson;
    if (typeof outputFieldsJson === 'string' && outputFieldsJson.trim()) {
      try {
        const parsed = JSON.parse(outputFieldsJson) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          addError(errors, node, 'config.outputFieldsJson', '多字段输出必须是 JSON 对象');
        }
      } catch {
        addError(errors, node, 'config.outputFieldsJson', '多字段输出 JSON 格式不正确');
      }
    }
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
