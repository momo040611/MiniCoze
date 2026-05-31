import { useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Select, Switch } from 'antd';
import {
  FlowNodeFormData,
  WorkflowContentChangeType,
  getNodeForm,
  type WorkflowNodeEntity,
} from '@flowgram.ai/free-layout-editor';
import type { EndConfig, LLMConfig, NodeMeta, VariableInfo } from '../nodeRenders/types';
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
  onClose: () => void;
};

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
        prompt: '请根据输入生成回答。',
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
                  rules={[{ required: true, message: '请输入变量名' }]}
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

function TypeSpecificFields({ nodeType }: { nodeType: string }) {
  const normalizedType = normalizeType(nodeType);

  if (normalizedType === 'llm') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>模型配置</div>
        <Form.Item label="模型" name={['config', 'model']}>
          <Select options={MODEL_OPTIONS} placeholder="请选择模型" />
        </Form.Item>
        <Form.Item label="温度" name={['config', 'temperature']}>
          <InputNumber min={0} max={2} step={0.1} className={styles.fullWidth} />
        </Form.Item>
        <Form.Item label="System Prompt" name={['config', 'systemPrompt']}>
          <Input.TextArea rows={4} placeholder="设置模型角色和约束" />
        </Form.Item>
        <Form.Item label="Prompt" name={['config', 'prompt']}>
          <Input.TextArea rows={5} placeholder="输入模型执行任务的提示词" />
        </Form.Item>
      </div>
    );
  }

  if (normalizedType === 'condition') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>条件配置</div>
        <Form.Item label="判断方式" name={['config', 'operator']}>
          <Select options={CONDITION_OPERATOR_OPTIONS} />
        </Form.Item>
        <Form.Item label="比较值" name={['config', 'compareValue']}>
          <Input placeholder="请输入比较值" />
        </Form.Item>
        <Form.Item label="自定义表达式" name={['config', 'expression']}>
          <Input.TextArea rows={3} placeholder="例如：input.status === 'success'" />
        </Form.Item>
      </div>
    );
  }

  if (normalizedType === 'plugin') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>插件配置</div>
        <Form.Item label="插件 ID" name={['config', 'pluginId']}>
          <Input placeholder="plugin.weather" />
        </Form.Item>
        <Form.Item label="调用动作" name={['config', 'action']}>
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
        <Form.Item label="数据源" name={['config', 'source']}>
          <Input placeholder="请选择或输入数据源" />
        </Form.Item>
        <Form.Item label="只读查询" name={['config', 'readonly']} valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="查询语句" name={['config', 'query']}>
          <Input.TextArea rows={5} placeholder="SELECT * FROM table WHERE id = :id" />
        </Form.Item>
      </div>
    );
  }

  if (normalizedType === 'end') {
    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>输出配置</div>
        <Form.Item label="输出方式" name={['config', 'outputMode']}>
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

function NodeConfigPanel({ selectedNode, onClose }: NodeConfigPanelProps) {
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
