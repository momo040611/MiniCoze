import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Form, Input, InputNumber, Select, Switch } from 'antd';
import {
  FlowNodeFormData,
  WorkflowContentChangeType,
  getNodeForm,
  type WorkflowNodeEntity,
} from '@flowgram.ai/free-layout-editor';
import type { WorkflowCanvasData } from '../../../api/workflows';
import { getPluginDetail, getPlugins } from '../../../api/plugins';
import { knowledgeApi } from '../../../api/knowledge-base';
import { useWorkspace } from '../../workspace/use-workspace';
import type { EndConfig, LLMConfig, NodeMeta, VariableInfo } from '../nodeRenders/types';
import type { NodeValidationError } from '../utils/validateWorkflow';
import styles from './NodeConfigPanel.module.css';

type NodeConfig = LLMConfig & EndConfig & Record<string, unknown>;

type NodeData = {
  nodeMeta?: NodeMeta;
  inputs?: VariableInfo[];
  outputs?: VariableInfo[];
  config?: NodeConfig;
};

type NodeConfigPanelProps = {
  selectedNode: WorkflowNodeEntity | null;
  validationErrors?: NodeValidationError[];
  onClose: () => void;
  onNodeDataChange?: (canvasData: WorkflowCanvasData) => void;
};

const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const VARIABLE_TYPE_OPTIONS = [
  { label: 'string', value: 'string' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
  { label: 'object', value: 'object' },
  { label: 'array', value: 'array' },
];

const MODEL_OPTIONS = [
  { label: 'deepseek-chat', value: 'deepseek-chat' },
  { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
  { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
];

const CONDITION_OPERATOR_OPTIONS = [
  { label: '等于', value: 'equals' },
  { label: '不等于', value: 'notEquals' },
  { label: '包含', value: 'contains' },
  { label: '大于', value: 'greaterThan' },
  { label: '小于', value: 'lessThan' },
  { label: '自定义表达式', value: 'expression' },
];

function normalizeType(type?: string) {
  if (type === 'input') return 'start';
  if (type === 'output' || type === 'end') return 'end';
  if (type === 'selector') return 'condition';
  return type ?? 'unknown';
}

function getNodeData(node: WorkflowNodeEntity | null): NodeData {
  if (!node) {
    return {};
  }

  const nodeForm = getNodeForm(node) as { values?: NodeData } | undefined;

  if (nodeForm?.values) {
    return nodeForm.values;
  }

  const nodeAny = node as unknown as {
    toJSON?: () => { data?: NodeData };
    getExtInfo?: () => NodeData;
  };

  return nodeAny.toJSON?.().data ?? nodeAny.getExtInfo?.() ?? {};
}

function syncFlowGramForm(node: WorkflowNodeEntity, data: NodeData) {
  const nodeAny = node as unknown as {
    getData?: (key: unknown) => unknown;
    updateExtInfo?: (data: NodeData, fire?: boolean) => void;
    document?: {
      fireContentChange?: (event: unknown) => void;
    };
  };
  const nodeForm = getNodeForm(node) as
    | {
        updateFormValues?: (values: NodeData) => void;
        setValueIn?: (name: string, value: unknown) => void;
      }
    | undefined;
  const formData = nodeAny.getData?.(FlowNodeFormData) as
    | {
        updateFormValues?: (values: NodeData) => void;
        getFormModel?: () => {
          updateFormValues?: (values: NodeData) => void;
          setValueIn?: (name: string, value: unknown) => void;
        };
      }
    | undefined;
  const formModel = formData?.getFormModel?.();

  nodeForm?.updateFormValues?.(data);
  formData?.updateFormValues?.(data);
  formModel?.updateFormValues?.(data);

  nodeForm?.setValueIn?.('nodeMeta', data.nodeMeta);
  nodeForm?.setValueIn?.('inputs', data.inputs);
  nodeForm?.setValueIn?.('outputs', data.outputs);
  nodeForm?.setValueIn?.('config', data.config);
  formModel?.setValueIn?.('nodeMeta', data.nodeMeta);
  formModel?.setValueIn?.('inputs', data.inputs);
  formModel?.setValueIn?.('outputs', data.outputs);
  formModel?.setValueIn?.('config', data.config);

  nodeAny.updateExtInfo?.(data, true);
  nodeAny.document?.fireContentChange?.({
    type: WorkflowContentChangeType.NODE_DATA_CHANGE,
    entity: node,
    toJSON: () => data,
  });
}

function getDefaultTitle(type: string) {
  const normalizedType = normalizeType(type);

  const titleMap: Record<string, string> = {
    start: '开始节点',
    llm: '大模型节点',
    condition: '条件节点',
    plugin: '插件节点',
    knowledge: '知识检索节点',
    code: '代码执行节点',
    http: 'HTTP 请求节点',
    variable: '变量读写节点',
    database: '数据库节点（旧版占位，请改用知识检索）',
    end: '结束节点',
  };

  return titleMap[normalizedType] ?? `${type} 节点`;
}

function getTypeDefaults(type?: string): Pick<NodeData, 'inputs' | 'outputs' | 'config'> {
  const normalizedType = normalizeType(type);

  if (normalizedType === 'start') {
    return {
      inputs: [],
      outputs: [{ label: '输出', type: 'string', name: 'query' }],
      config: {},
    };
  }

  if (normalizedType === 'end') {
    return {
      inputs: [{ label: '输入', type: 'string', name: 'content' }],
      outputs: [],
      config: { outputMode: '返回变量', resultExpression: '', outputFieldsJson: '' },
    };
  }

  if (normalizedType === 'llm') {
    return {
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

  if (normalizedType === 'condition') {
    return {
      inputs: [{ label: '输入', type: 'string', name: 'value' }],
      outputs: [
        { label: '是', type: 'boolean', name: 'trueBranch' },
        { label: '否', type: 'boolean', name: 'falseBranch' },
      ],
      config: {
        leftValue: '{{input.query}}',
        operator: 'equals',
        compareValue: '',
        expression: '',
      },
    };
  }

  if (normalizedType === 'plugin') {
    return {
      inputs: [{ label: '入参', type: 'object', name: 'payload' }],
      outputs: [{ label: '结果', type: 'object', name: 'result' }],
      config: {
        pluginId: '',
        toolId: '',
        args: {},
      },
    };
  }

  if (normalizedType === 'knowledge') {
    return {
      inputs: [{ label: '查询参数', type: 'string', name: 'query' }],
      outputs: [
        { label: '检索结果', type: 'array', name: 'results' },
        { label: '拼接文本', type: 'string', name: 'summary' },
      ],
      config: {
        knowledgeBaseIds: [],
        query: '',
        topK: 5,
      },
    };
  }

  if (normalizedType === 'code') {
    return {
      inputs: [{ label: '入参', type: 'object', name: 'params' }],
      outputs: [{ label: '结果', type: 'object', name: 'result' }],
      config: {
        code: 'const text = String(input.text ?? \'\');\nreturn { length: text.length, upper: text.toUpperCase() };',
        paramsJson: '{"text": "{{input.query}}"}',
      },
    };
  }

  if (normalizedType === 'http') {
    return {
      inputs: [{ label: '入参', type: 'object', name: 'params' }],
      outputs: [{ label: '响应', type: 'object', name: 'data' }],
      config: {
        url: 'https://httpbin.org/get',
        method: 'GET',
        headersJson: '{}',
        body: '',
        timeout: 30000,
      },
    };
  }

  if (normalizedType === 'variable') {
    return {
      inputs: [{ label: '入参', type: 'object', name: 'params' }],
      outputs: [{ label: '结果', type: 'object', name: 'result' }],
      config: {
        operation: 'set',
        scope: 'session',
        name: 'lastQuery',
        value: '{{input.query}}',
      },
    };
  }

  return {
    inputs: [{ label: '输入', type: 'string', name: 'input' }],
    outputs: [{ label: '输出', type: 'string', name: 'output' }],
    config: {},
  };
}

function getDefaultData(node: WorkflowNodeEntity | null): NodeData {
  const data = getNodeData(node);
  const type = String(node?.flowNodeType ?? 'unknown');
  const defaults = getTypeDefaults(type);

  return {
    nodeMeta: {
      title: data.nodeMeta?.title || getDefaultTitle(type),
      subTitle: data.nodeMeta?.subTitle,
      description: data.nodeMeta?.description,
      icon: data.nodeMeta?.icon,
      mainColor: data.nodeMeta?.mainColor,
    },
    inputs: data.inputs ?? defaults.inputs,
    outputs: data.outputs ?? defaults.outputs,
    config: {
      ...defaults.config,
      ...(data.config ?? {}),
    },
  };
}

function VariableList({ name, title }: { name: 'inputs' | 'outputs'; title: string }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      <Form.List name={name}>
        {(fields, { add, remove }) => (
          <div className={styles.variableList}>
            {fields.map((field) => (
              <div className={styles.variableCard} key={field.key}>
                <Form.Item
                  label="显示名"
                  name={[field.name, 'label']}
                  rules={[{ required: true, message: '请输入显示名' }]}
                >
                  <Input placeholder="输入" />
                </Form.Item>
                <Form.Item
                  label="变量名"
                  name={[field.name, 'name']}
                  rules={[
                    { required: true, message: '请输入变量名' },
                    {
                      pattern: VARIABLE_NAME_PATTERN,
                      message: '变量名只能使用字母、数字和下划线，且不能以数字开头',
                    },
                  ]}
                >
                  <Input placeholder="query" />
                </Form.Item>
                <Form.Item
                  label="类型"
                  name={[field.name, 'type']}
                  rules={[{ required: true, message: '请选择类型' }]}
                >
                  <Select options={VARIABLE_TYPE_OPTIONS} />
                </Form.Item>
                <Button danger type="link" onClick={() => remove(field.name)}>
                  删除变量
                </Button>
              </div>
            ))}
            <Button
              type="dashed"
              block
              onClick={() => add({ label: '变量', type: 'string', name: 'value' })}
            >
              添加变量
            </Button>
          </div>
        )}
      </Form.List>
    </div>
  );
}

// 插件节点配置：插件/工具下拉选择 + 入参 JSON。
function PluginConfigFields() {
  const form = Form.useFormInstance();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? '';
  const [pluginOptions, setPluginOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [toolOptions, setToolOptions] = useState<Array<{ label: string; value: string }>>([]);
  const selectedPluginId = Form.useWatch(['config', 'pluginId'], form);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    getPlugins({ workspaceId, page: 1, pageSize: 100 })
      .then((res) => {
        if (cancelled) return;
        setPluginOptions(
          res.list.map((plugin) => ({ label: `${plugin.name}（${plugin.code}）`, value: plugin.id })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    setToolOptions([]);
    if (!selectedPluginId) return;
    let cancelled = false;
    getPluginDetail(selectedPluginId)
      .then((detail) => {
        if (cancelled) return;
        setToolOptions(
          detail.tools
            .filter((tool) => tool.status === 'ACTIVE')
            .map((tool) => ({ label: `${tool.name}（${tool.code}）`, value: tool.id })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedPluginId]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>插件配置</div>
      <Form.Item
        label="插件"
        name={['config', 'pluginId']}
        rules={[{ required: true, message: '请选择插件' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          options={pluginOptions}
          placeholder="选择工作区内已安装的插件"
          onChange={() => form.setFieldValue(['config', 'toolId'], undefined)}
        />
      </Form.Item>
      <Form.Item
        label="工具"
        name={['config', 'toolId']}
        rules={[{ required: true, message: '请选择插件工具' }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          options={toolOptions}
          placeholder={selectedPluginId ? '选择要调用的工具' : '请先选择插件'}
          disabled={!selectedPluginId}
        />
      </Form.Item>
      <Form.Item
        label="入参 JSON"
        name={['config', 'argsJson']}
        tooltip='对象，值支持 {{引用}}，例如 {"query": "{{input.query}}"}'
        rules={[
          ({ getFieldValue }) => ({
            validator(_, value) {
              const raw = String(value ?? '').trim();
              if (!raw) return Promise.resolve();
              try {
                const parsed = JSON.parse(raw) as unknown;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('入参必须是 JSON 对象'));
              } catch {
                return Promise.reject(new Error('入参 JSON 格式不正确'));
              }
            },
          }),
        ]}
      >
        <Input.TextArea rows={4} placeholder='{"query": "{{input.query}}"}' />
      </Form.Item>
    </div>
  );
}

// 知识检索节点配置：知识库多选 + 检索问题 + topK。
function KnowledgeConfigFields() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? '';
  const [kbOptions, setKbOptions] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    knowledgeApi
      .getKnowledgeBases({ workspaceId, page: 1, pageSize: 100 })
      .then((res) => {
        if (cancelled) return;
        setKbOptions(res.data.list.map((kb) => ({ label: kb.name, value: kb.id })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>知识检索配置</div>
      <Form.Item
        label="知识库"
        name={['config', 'knowledgeBaseIds']}
        rules={[{ required: true, message: '请至少选择一个知识库' }]}
      >
        <Select mode="multiple" options={kbOptions} placeholder="选择要检索的知识库" />
      </Form.Item>
      <Form.Item
        label="检索问题"
        name={['config', 'query']}
        rules={[{ required: true, message: '请输入检索问题' }]}
      >
        <Input.TextArea rows={3} placeholder="支持 {{引用}}，例如：{{input.query}}" />
      </Form.Item>
      <Form.Item label="召回条数" name={['config', 'topK']}>
        <InputNumber min={1} max={20} className={styles.fullWidth} />
      </Form.Item>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>输出说明</div>
        <p style={{ margin: 0, fontSize: 12, color: '#8c8c8c' }}>
          输出 results（结构化片段数组）与 summary（拼接文本，可直接给 LLM 节点引用）。
        </p>
      </div>
    </div>
  );
}

// 代码执行节点配置：JS 代码 + 入参映射 JSON。
function CodeConfigFields() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>代码配置</div>
      <Form.Item
        label="代码（函数体）"
        name={['config', 'code']}
        tooltip="用 return 返回一个对象作为节点输出；可访问 input（= 入参映射解析后的对象）。禁止 require/process/import/async。"
        rules={[{ required: true, message: '请输入代码' }]}
      >
        <Input.TextArea
          rows={8}
          placeholder={'const text = String(input.text ?? \'\');\nreturn { length: text.length };'}
          style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 12 }}
        />
      </Form.Item>
      <Form.Item
        label="入参映射 JSON"
        name={['config', 'paramsJson']}
        tooltip='对象，值支持 {{引用}}，例如 {"text": "{{input.query}}"}'
        rules={[
          {
            validator(_, value) {
              const raw = String(value ?? '').trim();
              if (!raw) return Promise.resolve();
              try {
                const parsed = JSON.parse(raw) as unknown;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('入参必须是 JSON 对象'));
              } catch {
                return Promise.reject(new Error('入参 JSON 格式不正确'));
              }
            },
          },
        ]}
      >
        <Input.TextArea rows={3} placeholder='{"text": "{{input.query}}"}' />
      </Form.Item>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>输出说明</div>
        <p style={{ margin: 0, fontSize: 12, color: '#8c8c8c' }}>
          代码 return 的对象即节点输出，后续节点可通过 {'{{节点ID.字段}}'} 引用。
        </p>
      </div>
    </div>
  );
}

// HTTP 请求节点配置：地址 / 方法 / 请求头 / 请求体 / 超时。
function HttpConfigFields() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>请求配置</div>
      <Form.Item
        label="请求地址"
        name={['config', 'url']}
        tooltip="支持 {{引用}}，必须为 http(s) 地址"
        rules={[
          { required: true, message: '请输入请求地址' },
          {
            validator(_, value) {
              const raw = String(value ?? '').trim();
              if (!raw) return Promise.resolve();
              if (/^https?:\/\/.+/.test(raw) || /\{\{.+?\}\}/.test(raw)) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('请输入 http:// 或 https:// 开头的地址'));
            },
          },
        ]}
      >
        <Input placeholder="https://api.example.com/search" />
      </Form.Item>
      <Form.Item label="请求方式" name={['config', 'method']}>
        <Select
          options={[
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
            { label: 'PUT', value: 'PUT' },
            { label: 'PATCH', value: 'PATCH' },
            { label: 'DELETE', value: 'DELETE' },
          ]}
        />
      </Form.Item>
      <Form.Item
        label="请求头 JSON"
        name={['config', 'headersJson']}
        tooltip='对象，值支持 {{引用}}，例如 {"Authorization": "Bearer xxx"}'
        rules={[
          {
            validator(_, value) {
              const raw = String(value ?? '').trim();
              if (!raw) return Promise.resolve();
              try {
                const parsed = JSON.parse(raw) as unknown;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('请求头必须是 JSON 对象'));
              } catch {
                return Promise.reject(new Error('请求头 JSON 格式不正确'));
              }
            },
          },
        ]}
      >
        <Input.TextArea rows={3} placeholder='{"Authorization": "Bearer sk-xxx"}' />
      </Form.Item>
      <Form.Item
        label="请求体"
        name={['config', 'body']}
        tooltip="仅 POST/PUT/PATCH 生效，支持 {{引用}}"
      >
        <Input.TextArea rows={4} placeholder='{"query": "{{input.query}}"}' />
      </Form.Item>
      <Form.Item label="超时（毫秒）" name={['config', 'timeout']}>
        <InputNumber min={1000} max={120000} step={1000} className={styles.fullWidth} />
      </Form.Item>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>输出说明</div>
        <p style={{ margin: 0, fontSize: 12, color: '#8c8c8c' }}>
          输出 status（状态码）、ok（是否 2xx）、data（响应体），可用条件节点按状态分流。
        </p>
      </div>
    </div>
  );
}

// 变量读写节点配置：操作 / 作用域 / 变量名 / 写入值。
function VariableConfigFields() {
  const form = Form.useFormInstance();
  const operation = Form.useWatch(['config', 'operation'], form);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>变量配置</div>
      <Form.Item label="操作" name={['config', 'operation']}>
        <Select
          options={[
            { label: '写入（set）', value: 'set' },
            { label: '读取（get）', value: 'get' },
          ]}
        />
      </Form.Item>
      <Form.Item label="作用域" name={['config', 'scope']}>
        <Select
          options={[
            { label: '会话级（session）', value: 'session' },
            { label: '全局级（global）', value: 'global' },
          ]}
        />
      </Form.Item>
      <Form.Item
        label="变量名"
        name={['config', 'name']}
        rules={[
          { required: true, message: '请输入变量名' },
          {
            pattern: VARIABLE_NAME_PATTERN,
            message: '变量名只能使用字母、数字和下划线，且不能以数字开头',
          },
        ]}
      >
        <Input placeholder="lastQuery" />
      </Form.Item>
      {operation !== 'get' && (
        <Form.Item
          label="写入值"
          name={['config', 'value']}
          tooltip="支持 {{引用}}，会按原始类型写入"
        >
          <Input.TextArea rows={3} placeholder="{{input.query}}" />
        </Form.Item>
      )}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>使用说明</div>
        <p style={{ margin: 0, fontSize: 12, color: '#8c8c8c' }}>
          写入后，后续节点可用 {'{{session.变量名}}'} 或 {'{{global.变量名}}'} 读取；会话级写入需要运行输入中带 sessionId。
        </p>
      </div>
    </div>
  );
}

function TypeSpecificFields({ nodeType }: { nodeType: string }) {
  const normalizedType = normalizeType(nodeType);

  if (normalizedType === 'llm') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>模型配置</div>
        <Form.Item
          label="模型"
          name={['config', 'model']}
          rules={[{ required: true, message: '请选择模型' }]}
        >
          <Select options={MODEL_OPTIONS} placeholder="请选择模型" />
        </Form.Item>
        <Form.Item
          label="温度"
          name={['config', 'temperature']}
          rules={[{ type: 'number', min: 0, max: 2, message: '温度必须在 0 到 2 之间' }]}
        >
          <InputNumber min={0} max={2} step={0.1} className={styles.fullWidth} />
        </Form.Item>
        <Form.Item label="System Prompt" name={['config', 'systemPrompt']}>
          <Input.TextArea rows={4} placeholder="设置模型角色和约束" />
        </Form.Item>
        <Form.Item
          label="Prompt"
          name={['config', 'prompt']}
          rules={[{ required: true, message: '请输入 Prompt' }]}
        >
          <Input.TextArea rows={5} placeholder="输入模型执行任务的提示词" />
        </Form.Item>
      </div>
    );
  }

  if (normalizedType === 'condition') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>条件配置</div>
        <Form.Item
          label="判断取值"
          name={['config', 'leftValue']}
          tooltip="参与比较的值引用，默认取 {{input.query}}，也可写 {{llm_1.content}} 等上游输出"
        >
          <Input placeholder="{{input.query}}" />
        </Form.Item>
        <Form.Item
          label="判断方式"
          name={['config', 'operator']}
          rules={[{ required: true, message: '请选择判断方式' }]}
        >
          <Select options={CONDITION_OPERATOR_OPTIONS} />
        </Form.Item>
        <Form.Item
          label="比较值"
          name={['config', 'compareValue']}
          dependencies={[['config', 'operator']]}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (getFieldValue(['config', 'operator']) === 'expression' || String(value ?? '').trim()) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error('请输入比较值'));
              },
            }),
          ]}
        >
          <Input placeholder="请输入比较值，支持 {{引用}}" />
        </Form.Item>
        <Form.Item
          label="自定义表达式"
          name={['config', 'expression']}
          dependencies={[['config', 'operator']]}
          tooltip="运行时按「取值是否非空」判断，建议优先使用比较运算符"
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (getFieldValue(['config', 'operator']) !== 'expression' || String(value ?? '').trim()) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error('请输入自定义表达式'));
              },
            }),
          ]}
        >
          <Input.TextArea rows={3} placeholder="例如：input.status === 'success'" />
        </Form.Item>
        <Alert
          type="info"
          showIcon
          message="分支连线说明"
          description="从条件节点拉出的第一条连线 = 条件成立，第二条连线 = 条件不成立；请按此顺序连线。"
        />
      </div>
    );
  }

  if (normalizedType === 'plugin') {
    return <PluginConfigFields />;
  }

  if (normalizedType === 'knowledge') {
    return <KnowledgeConfigFields />;
  }

  if (normalizedType === 'code') {
    return <CodeConfigFields />;
  }

  if (normalizedType === 'http') {
    return <HttpConfigFields />;
  }

  if (normalizedType === 'variable') {
    return <VariableConfigFields />;
  }

  if (normalizedType === 'database') {
    return (
      <Alert
        type="warning"
        showIcon
        message="数据库节点已下线"
        description="旧版数据库节点为占位实现，请改用「知识检索」节点，或用 HTTP 节点对接数据库 API。"
      />
    );
  }

  if (normalizedType === 'end') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>输出配置</div>
        <Form.Item
          label="输出方式"
          name={['config', 'outputMode']}
          rules={[{ required: true, message: '请选择输出方式' }]}
        >
          <Select
            options={[
              { label: '返回变量', value: '返回变量' },
              { label: '返回文本', value: '返回文本' },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="输出引用（单值）"
          name={['config', 'resultExpression']}
          tooltip="填写一个引用，如 {{code_1.upper}}，该值将作为工作流最终输出 result；留空则回退到模型文本"
        >
          <Input placeholder="{{节点ID.字段}}" />
        </Form.Item>
        <Form.Item
          label="多字段输出 JSON"
          name={['config', 'outputFieldsJson']}
          tooltip='填写对象可自定义输出结构，优先级高于单值引用，例如 {"统计结果": "{{code_1.summary}}"}'
          rules={[
            {
              validator(_, value) {
                const raw = String(value ?? '').trim();
                if (!raw) return Promise.resolve();
                try {
                  const parsed = JSON.parse(raw) as unknown;
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('多字段输出必须是 JSON 对象'));
                } catch {
                  return Promise.reject(new Error('多字段输出 JSON 格式不正确'));
                }
              },
            },
          ]}
        >
          <Input.TextArea rows={4} placeholder='{"统计结果": "{{code_1.summary}}"}' />
        </Form.Item>
      </div>
    );
  }

  return null;
}

function NodeConfigPanel({
  selectedNode,
  validationErrors = [],
  onClose,
  onNodeDataChange,
}: NodeConfigPanelProps) {
  const [form] = Form.useForm<NodeData>();
  const [panelTitle, setPanelTitle] = useState('节点配置');
  const nodeType = String(selectedNode?.flowNodeType ?? '');

  const initialData = useMemo(() => getDefaultData(selectedNode), [selectedNode]);

  useEffect(() => {
    form.setFieldsValue(initialData);
    setPanelTitle(initialData.nodeMeta?.title ? `${initialData.nodeMeta.title} 配置` : '节点配置');
  }, [form, initialData]);

  function handleValuesChange(_: unknown, values: NodeData) {
    if (!selectedNode) {
      return;
    }

    const nextData: NodeData = {
      nodeMeta: {
        title: values.nodeMeta?.title || getDefaultTitle(nodeType),
        subTitle: values.nodeMeta?.subTitle,
        description: values.nodeMeta?.description,
        icon: values.nodeMeta?.icon,
        mainColor: values.nodeMeta?.mainColor,
      },
      inputs: values.inputs ?? [],
      outputs: values.outputs ?? [],
      config: values.config ?? {},
    };

    setPanelTitle(`${nextData.nodeMeta?.title ?? '节点'} 配置`);
    syncFlowGramForm(selectedNode, nextData);

    const nodeAny = selectedNode as unknown as {
      document?: {
        toJSON?: () => WorkflowCanvasData;
      };
    };
    const nextCanvasData = nodeAny.document?.toJSON?.();

    if (nextCanvasData) {
      onNodeDataChange?.(nextCanvasData);
    }
  }

  return (
    <Drawer
      title={
        <div>
          <div className={styles.title}>{panelTitle}</div>
          <div className={styles.subTitle}>类型：{nodeType || '-'}</div>
        </div>
      }
      open={Boolean(selectedNode)}
      width={420}
      onClose={onClose}
      destroyOnHidden
      mask={false}
      className={styles.drawer}
      rootClassName={styles.drawerRoot}
    >
      {validationErrors.length > 0 && (
        <Alert
          type="error"
          showIcon
          message="当前节点配置有误"
          description={
            <ul className={styles.errorList}>
              {validationErrors.map((error) => (
                <li key={`${error.field}-${error.message}`}>{error.message}</li>
              ))}
            </ul>
          }
          className={styles.errorAlert}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        className={styles.form}
        onValuesChange={handleValuesChange}
      >
        <div className={styles.section}>
          <div className={styles.sectionTitle}>基础信息</div>
          <Form.Item
            label="节点名称"
            name={['nodeMeta', 'title']}
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input placeholder="请输入节点名称" />
          </Form.Item>
          <Form.Item label="节点说明" name={['nodeMeta', 'description']}>
            <Input.TextArea rows={3} placeholder="请输入节点说明" />
          </Form.Item>
        </div>

        {normalizeType(nodeType) !== 'start' && <VariableList name="inputs" title="输入变量" />}

        {normalizeType(nodeType) !== 'end' && <VariableList name="outputs" title="输出变量" />}

        <TypeSpecificFields nodeType={nodeType} />
      </Form>
    </Drawer>
  );
}

export default NodeConfigPanel;
