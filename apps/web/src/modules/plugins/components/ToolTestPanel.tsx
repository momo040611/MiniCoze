import { App, Button, Divider, Form, Input, InputNumber, Select, Space, Switch, Tag } from 'antd';
import type { FormInstance } from 'antd';
import type { IPluginTool, IToolParam } from '../../../api/plugins';
import { useToolTest } from '../hooks/useToolTest';
import styles from './ToolTestPanel.module.css';

interface IToolTestPanelProps {
  tool: IPluginTool;
}

type IFormValues = Record<string, unknown>;

function getDefaultValue(param: IToolParam) {
  if (param.default !== undefined) return param.default;
  if (param.type === 'boolean') return false;
  if (param.type === 'number' || param.type === 'integer') return 0;
  if (param.type === 'array') return [];
  if (param.type === 'object') return {};
  return '';
}

function buildInitialValues(tool: IPluginTool): IFormValues {
  return Object.fromEntries(
    Object.entries(tool.inputSchema.properties).map(([key, param]) => [key, getDefaultValue(param)]),
  );
}

function parseStructuredValue(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return value;
  if (!value.trim()) return fallback;
  return JSON.parse(value) as unknown;
}

function collectValues(form: FormInstance<IFormValues>, tool: IPluginTool) {
  const rawValues = form.getFieldsValue();
  return Object.fromEntries(
    Object.entries(tool.inputSchema.properties).map(([key, param]) => {
      const value = rawValues[key];
      if (param.type === 'object') return [key, parseStructuredValue(value, {})];
      if (param.type === 'array') return [key, parseStructuredValue(value, [])];
      return [key, value];
    }),
  );
}

function renderInput(param: IToolParam) {
  if (param.enum?.length) {
    return <Select options={param.enum.map((value) => ({ label: value, value }))} />;
  }

  if (param.type === 'number' || param.type === 'integer') {
    return <InputNumber className={styles.fullInput} precision={param.type === 'integer' ? 0 : undefined} />;
  }

  if (param.type === 'boolean') {
    return <Switch />;
  }

  if (param.type === 'object' || param.type === 'array') {
    return <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} />;
  }

  return <Input />;
}

function formatInitialValue(param: IToolParam) {
  const value = getDefaultValue(param);
  if (param.type === 'object' || param.type === 'array') {
    return JSON.stringify(value, null, 2);
  }
  return value;
}

export function ToolTestPanel({ tool }: IToolTestPanelProps) {
  const [form] = Form.useForm<IFormValues>();
  const { message } = App.useApp();
  const { testing, error, records, runTest, clear } = useToolTest();
  const initialValues = Object.fromEntries(
    Object.entries(tool.inputSchema.properties).map(([key, param]) => [key, formatInitialValue(param)]),
  );

  const handleTest = async () => {
    try {
      await form.validateFields();
      const params = collectValues(form, tool);
      const result = await runTest(tool.id, params, tool.pluginId);
      if (result.success) {
        message.success('工具测试成功');
      } else {
        message.error(result.error ?? '工具测试失败');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        message.error('JSON 参数格式不正确');
        return;
      }
      message.error('请先检查必填参数');
    }
  };

  const handleUseRawJson = () => {
    form.setFieldsValue({
      rawJson: JSON.stringify(collectValues(form, tool), null, 2),
    });
  };

  const handleRawJsonTest = async () => {
    const rawJson = form.getFieldValue('rawJson');
    try {
      const params = JSON.parse(typeof rawJson === 'string' ? rawJson : '{}') as Record<string, unknown>;
      const result = await runTest(tool.id, params, tool.pluginId);
      if (result.success) {
        message.success('工具测试成功');
      } else {
        message.error(result.error ?? '工具测试失败');
      }
    } catch {
      message.error('JSON 参数格式不正确');
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3>{tool.name}</h3>
          <p>{tool.description}</p>
        </div>
        <Tag color={tool.enabled ? 'success' : 'default'}>{tool.enabled ? '可用' : '不可用'}</Tag>
      </div>

      <Form form={form} layout="vertical" initialValues={{ ...initialValues, rawJson: JSON.stringify(buildInitialValues(tool), null, 2) }}>
        {Object.entries(tool.inputSchema.properties).map(([key, param]) => (
          <Form.Item
            key={key}
            name={key}
            label={key}
            tooltip={param.description}
            valuePropName={param.type === 'boolean' ? 'checked' : 'value'}
            rules={[
              {
                required: tool.inputSchema.required?.includes(key),
                message: `请输入 ${key}`,
              },
            ]}
          >
            {renderInput(param)}
          </Form.Item>
        ))}

        <Space>
          <Button type="primary" loading={testing} disabled={!tool.enabled} onClick={handleTest}>
            开始测试
          </Button>
          <Button onClick={handleUseRawJson}>同步到 JSON</Button>
          <Button onClick={clear}>清空记录</Button>
        </Space>

        <Divider titlePlacement="left">JSON 原始输入</Divider>
        <Form.Item name="rawJson">
          <Input.TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
        </Form.Item>
        <Button loading={testing} disabled={!tool.enabled} onClick={handleRawJsonTest}>
          使用 JSON 测试
        </Button>
      </Form>

      <Divider titlePlacement="left">最近 5 次测试</Divider>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.records}>
        {records.length === 0 ? (
          <div className={styles.empty}>暂无测试记录</div>
        ) : (
          records.map((record) => (
            <div className={styles.record} key={record.id}>
              <div className={styles.recordTitle}>
                <Tag color={record.success ? '#52c41a' : '#ff4d4f'}>{record.success ? '成功' : '失败'}</Tag>
                <span>{new Date(record.createdAt).toLocaleTimeString()}</span>
                {record.duration !== undefined && <span>{record.duration} ms</span>}
              </div>
              <pre>{JSON.stringify(record.success ? record.data ?? record.output : record.error, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
