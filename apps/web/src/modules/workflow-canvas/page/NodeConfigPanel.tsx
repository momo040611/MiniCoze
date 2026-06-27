import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Form, Input, InputNumber, Select, Switch } from 'antd';
import {
  FlowNodeFormData,
  WorkflowContentChangeType,
  getNodeForm,
  type WorkflowNodeEntity,
} from '@flowgram.ai/free-layout-editor';
import type { WorkflowCanvasData } from '../../../api/workflows';
import type {
  ConditionBranch,
  ConditionConfig,
  EndConfig,
  LLMConfig,
  LoopConfig,
  NodeMeta,
  VariableInfo,
} from '../nodeRenders/types';
import type { NodeValidationError } from '../utils/validateWorkflow';
import styles from './NodeConfigPanel.module.css';

type NodeConfig = LLMConfig & EndConfig & ConditionConfig & LoopConfig & Record<string, unknown>;

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
  { label: '不包含', value: 'notContains' },
  { label: '大于', value: 'gt' },
  { label: '大于等于', value: 'gte' },
  { label: '小于', value: 'lt' },
  { label: '小于等于', value: 'lte' },
  { label: '为空', value: 'empty' },
  { label: '不为空', value: 'notEmpty' },
];

const CONDITION_LOGIC_OPTIONS = [
  { label: '满足全部条件', value: 'and' },
  { label: '满足任一条件', value: 'or' },
];

const LOOP_ON_ERROR_OPTIONS = [
  { label: '遇到错误停止', value: 'abort' },
  { label: '跳过错误继续', value: 'continue' },
];

const DEFAULT_LOOP_BLOCKS_JSON = JSON.stringify([
  {
    id: 'loop_llm_1',
    type: 'llm',
    data: {
      inputs: {
        model: 'deepseek-chat',
        prompt: '请处理当前循环项：{{loop.item}}',
        systemPrompt: '你是一个可靠的批处理助手。',
        temperature: 0.7,
      },
    },
  },
], null, 2);

const DEFAULT_LOOP_EDGES_JSON = JSON.stringify([], null, 2);

function getDefaultConditionBranch(): ConditionBranch {
  return {
    port: 'true',
    name: '是',
    logic: 'and',
    conditions: [{ left: '{{input.value}}', op: 'equals', right: '' }],
  };
}

function getDefaultConditionConfig(): ConditionConfig {
  return {
    branches: [getDefaultConditionBranch()],
    defaultPort: 'false',
  };
}

function normalizeConditionConfig(config: NodeConfig): ConditionConfig {
  if (Array.isArray(config.branches) && config.branches.length > 0) {
    return {
      branches: config.branches.map((branch, index) => ({
        port: branch.port || (index === 0 ? 'true' : `branch_${index + 1}`),
        name: branch.name || (index === 0 ? '是' : `分支 ${index + 1}`),
        logic: branch.logic === 'or' ? 'or' : 'and',
        conditions: Array.isArray(branch.conditions) && branch.conditions.length > 0
          ? branch.conditions.map((condition) => ({
              left: condition.left ?? '',
              op: condition.op ?? 'equals',
              right: condition.right ?? '',
            }))
          : [{ left: '{{input.value}}', op: 'equals', right: '' }],
      })),
      defaultPort: config.defaultPort || 'false',
    };
  }

  if (config.operator) {
    const legacyOperator = config.operator === 'greaterThan'
      ? 'gt'
      : config.operator === 'lessThan'
        ? 'lt'
        : config.operator;

    return {
      branches: [
        {
          ...getDefaultConditionBranch(),
          conditions: [
            {
              left: '{{input.value}}',
              op: legacyOperator as ConditionBranch['conditions'][number]['op'],
              right: config.compareValue ?? '',
            },
          ],
        },
      ],
      defaultPort: 'false',
    };
  }

  return getDefaultConditionConfig();
}

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
    database: '数据库节点',
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
      config: { outputMode: '返回变量' },
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
        { label: '是', type: 'boolean', name: 'true' },
        { label: '否', type: 'boolean', name: 'false' },
      ],
      config: getDefaultConditionConfig(),
    };
  }

  if (normalizedType === 'loop') {
    return {
      inputs: [{ label: '循环数组', type: 'array', name: 'items' }],
      outputs: [
        { label: '次数', type: 'number', name: 'count' },
        { label: '结果', type: 'array', name: 'results' },
      ],
      config: {
        items: '{{input.items}}',
        concurrency: 5,
        onError: 'abort',
        blocksJson: DEFAULT_LOOP_BLOCKS_JSON,
        edgesJson: DEFAULT_LOOP_EDGES_JSON,
      },
    };
  }

  if (normalizedType === 'plugin') {
    return {
      inputs: [{ label: '入参', type: 'object', name: 'payload' }],
      outputs: [{ label: '结果', type: 'object', name: 'result' }],
      config: {
        pluginId: '',
        action: '',
        timeout: 30,
      },
    };
  }

  if (normalizedType === 'database') {
    return {
      inputs: [{ label: '查询参数', type: 'object', name: 'params' }],
      outputs: [{ label: '查询结果', type: 'array', name: 'rows' }],
      config: {
        source: '',
        query: '',
        readonly: true,
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
  const config = {
    ...defaults.config,
    ...(data.config ?? {}),
  };

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
    config: normalizeType(type) === 'condition' ? normalizeConditionConfig(config) : config,
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

function ConditionFields() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>条件配置</div>
      <Form.List name={['config', 'branches']}>
        {(branchFields, { add: addBranch, remove: removeBranch }) => (
          <div className={styles.variableList}>
            {branchFields.map((branchField, branchIndex) => (
              <div className={styles.variableCard} key={branchField.key}>
                <Form.Item
                  label="分支名称"
                  name={[branchField.name, 'name']}
                  rules={[{ required: true, message: '请输入分支名称' }]}
                >
                  <Input placeholder={`分支 ${branchIndex + 1}`} />
                </Form.Item>

                <Form.Item
                  label="出口端口"
                  name={[branchField.name, 'port']}
                  rules={[{ required: true, message: '请输入出口端口' }]}
                >
                  <Input placeholder="true" />
                </Form.Item>

                <Form.Item
                  label="条件关系"
                  name={[branchField.name, 'logic']}
                  rules={[{ required: true, message: '请选择条件关系' }]}
                >
                  <Select options={CONDITION_LOGIC_OPTIONS} />
                </Form.Item>

                <Form.List name={[branchField.name, 'conditions']}>
                  {(conditionFields, { add: addCondition, remove: removeCondition }) => (
                    <div className={styles.variableList}>
                      {conditionFields.map((conditionField) => (
                        <div className={styles.conditionCard} key={conditionField.key}>
                          <Form.Item
                            label="左值"
                            name={[conditionField.name, 'left']}
                            rules={[{ required: true, message: '请输入左值' }]}
                          >
                            <Input placeholder="{{input.value}}" />
                          </Form.Item>

                          <Form.Item
                            label="判断方式"
                            name={[conditionField.name, 'op']}
                            rules={[{ required: true, message: '请选择判断方式' }]}
                          >
                            <Select options={CONDITION_OPERATOR_OPTIONS} />
                          </Form.Item>

                          <Form.Item
                            noStyle
                            shouldUpdate={(prev, next) => (
                              prev?.config?.branches?.[branchField.name]?.conditions?.[conditionField.name]?.op !==
                              next?.config?.branches?.[branchField.name]?.conditions?.[conditionField.name]?.op
                            )}
                          >
                            {({ getFieldValue }) => {
                              const op = getFieldValue([
                                'config',
                                'branches',
                                branchField.name,
                                'conditions',
                                conditionField.name,
                                'op',
                              ]);
                              const needRight = op !== 'empty' && op !== 'notEmpty';

                              return (
                                <Form.Item
                                  label="右值"
                                  name={[conditionField.name, 'right']}
                                  rules={[
                                    {
                                      required: needRight,
                                      message: '请输入右值',
                                    },
                                  ]}
                                >
                                  <Input disabled={!needRight} placeholder="比较值" />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>

                          {conditionFields.length > 1 && (
                            <Button danger type="link" onClick={() => removeCondition(conditionField.name)}>
                              删除条件
                            </Button>
                          )}
                        </div>
                      ))}

                      <Button
                        type="dashed"
                        block
                        onClick={() => addCondition({ left: '{{input.value}}', op: 'equals', right: '' })}
                      >
                        添加条件
                      </Button>
                    </div>
                  )}
                </Form.List>

                {branchFields.length > 1 && (
                  <Button danger type="link" onClick={() => removeBranch(branchField.name)}>
                    删除分支
                  </Button>
                )}
              </div>
            ))}

            <Button
              type="dashed"
              block
              onClick={() => addBranch({
                port: `branch_${branchFields.length + 1}`,
                name: `分支 ${branchFields.length + 1}`,
                logic: 'and',
                conditions: [{ left: '{{input.value}}', op: 'equals', right: '' }],
              })}
            >
              添加分支
            </Button>
          </div>
        )}
      </Form.List>

      <Form.Item
        label="默认出口端口"
        name={['config', 'defaultPort']}
        rules={[{ required: true, message: '请输入默认出口端口' }]}
      >
        <Input placeholder="false" />
      </Form.Item>
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
    return <ConditionFields />;
  }

  if (normalizedType === 'loop') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>循环配置</div>
        <Form.Item
          label="循环数组"
          name={['config', 'items']}
          rules={[{ required: true, message: '请输入循环数组变量，例如 {{input.items}}' }]}
        >
          <Input placeholder="{{input.items}}" />
        </Form.Item>
        <Form.Item
          label="并发数"
          name={['config', 'concurrency']}
          rules={[{ type: 'number', min: 1, max: 20, message: '并发数必须在 1 到 20 之间' }]}
        >
          <InputNumber min={1} max={20} className={styles.fullWidth} />
        </Form.Item>
        <Form.Item
          label="失败策略"
          name={['config', 'onError']}
          rules={[{ required: true, message: '请选择失败策略' }]}
        >
          <Select options={LOOP_ON_ERROR_OPTIONS} />
        </Form.Item>
        <Form.Item
          label="内部节点 JSON"
          name={['config', 'blocksJson']}
          rules={[{ required: true, message: '请输入内部节点 JSON 数组' }]}
        >
          <Input.TextArea rows={8} placeholder={DEFAULT_LOOP_BLOCKS_JSON} />
        </Form.Item>
        <Form.Item label="内部连线 JSON" name={['config', 'edgesJson']}>
          <Input.TextArea rows={4} placeholder={DEFAULT_LOOP_EDGES_JSON} />
        </Form.Item>
      </div>
    );
  }

  if (normalizedType === 'plugin') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>插件配置</div>
        <Form.Item
          label="插件 ID"
          name={['config', 'pluginId']}
          rules={[{ required: true, message: '请输入插件 ID' }]}
        >
          <Input placeholder="plugin.weather" />
        </Form.Item>
        <Form.Item
          label="调用动作"
          name={['config', 'action']}
          rules={[{ required: true, message: '请输入调用动作' }]}
        >
          <Input placeholder="search / run / query" />
        </Form.Item>
        <Form.Item label="超时时间（秒）" name={['config', 'timeout']}>
          <InputNumber min={1} max={300} className={styles.fullWidth} />
        </Form.Item>
      </div>
    );
  }

  if (normalizedType === 'database') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>数据库配置</div>
        <Form.Item
          label="数据源"
          name={['config', 'source']}
          rules={[{ required: true, message: '请输入数据源' }]}
        >
          <Input placeholder="请选择或输入数据源" />
        </Form.Item>
        <Form.Item label="只读查询" name={['config', 'readonly']} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item
          label="查询语句"
          name={['config', 'query']}
          rules={[{ required: true, message: '请输入查询语句' }]}
        >
          <Input.TextArea rows={5} placeholder="SELECT * FROM table WHERE id = :id" />
        </Form.Item>
      </div>
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
      config: normalizeType(nodeType) === 'condition'
        ? normalizeConditionConfig(values.config ?? {})
        : values.config ?? {},
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
