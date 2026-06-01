// 变量解析器：负责把工作流里的 {{...}} 引用解析成真实值。
// 支持的引用形式：
// - {{input.xxx}}          运行输入字段
// - {{<nodeId>.output.x}}  某节点输出的字段
// - {{<nodeId>.output}}    某节点的完整输出
// - {{loop.item}}          当前循环项
// - {{loop.index}}         当前循环下标

export interface VariableScope {
  input: Record<string, unknown>;
  nodeOutputs: Record<string, Record<string, unknown>>;
  loop?: Record<string, unknown>;
}

const INLINE_REF_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;
const FULL_REF_PATTERN = /^\{\{\s*([^}]+?)\s*\}\}$/;

// 解析单个引用：当整段就是一个 {{...}} 时返回原始值（保留数组/对象类型），
// 否则按模板字符串处理；非字符串原样返回。
export function resolveValueRef(ref: unknown, scope: VariableScope): unknown {
  if (typeof ref !== 'string') {
    return ref;
  }

  const trimmed = ref.trim();
  const fullMatch = FULL_REF_PATTERN.exec(trimmed);
  if (fullMatch) {
    return lookupPath(fullMatch[1].trim(), scope);
  }

  if (trimmed.includes('{{')) {
    return resolveTemplate(trimmed, scope);
  }

  return ref;
}

// 解析模板字符串：把其中所有 {{...}} 替换为对应值（对象/数组会被 JSON 序列化）。
export function resolveTemplate(template: string, scope: VariableScope): string {
  return template.replace(INLINE_REF_PATTERN, (_match, rawPath: string) => {
    const value = lookupPath(rawPath.trim(), scope);
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  });
}

//去scope里取值，path是{{...}}里的内容
function lookupPath(path: string, scope: VariableScope): unknown {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return undefined;
  }

  const [head, ...rest] = segments;
  let base: unknown;
  let restSegments = rest;

  if (head === 'input') {
    base = scope.input;
  } else if (head === 'loop') {
    base = scope.loop ?? {};
  } else if (scope.nodeOutputs[head] !== undefined) {
    base = scope.nodeOutputs[head];
    // 兼容 {{nodeId.output.x}} 写法：跳过中间的 "output" 段。
    if (restSegments[0] === 'output') {
      restSegments = restSegments.slice(1);
    }
  } else if (scope.loop && scope.loop[head] !== undefined) {
    base = scope.loop[head];
  } else {
    return undefined;
  }

  return walk(base, restSegments);
}

//递归取值
function walk(base: unknown, segments: string[]): unknown {
  let current = base;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
