import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Drawer, Form, Input, Space, Switch, Tag, Typography, message } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import {
  runWorkflowStreamRemote,
  saveWorkflowDraftRemote,
  toRunnableWorkflowDefinition,
  type WorkflowCanvasData,
  type WorkflowRunNodeStatus,
  type WorkflowRunStatus,
  type WorkflowStreamEvent,
} from '../../../api';
import styles from './RunTestPanel.module.css';

type RunTestPanelProps = {
  open: boolean;
  workflowId: string;
  canvasData?: WorkflowCanvasData | null;
  onClose: () => void;
};

type InputField = {
  name: string;
  label: string;
  type: string;
};

type StreamNodeRecord = {
  key: string;
  nodeId: string;
  nodeType: string;
  status: WorkflowRunNodeStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  durationMs: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function getNodeTitle(canvasData: WorkflowCanvasData | null | undefined, nodeId: string, nodeType: string) {
  const node = canvasData?.nodes.find((item) => isRecord(item) && item.id === nodeId);

  if (!isRecord(node)) {
    return nodeId || nodeType;
  }

  const data = isRecord(node.data) ? node.data : {};
  const nodeMeta = isRecord(data.nodeMeta) ? data.nodeMeta : {};
  const title = nodeMeta.title;

  return typeof title === 'string' && title.trim() ? title.trim() : nodeId || nodeType;
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null) {
    return '--';
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(2)}s`;
}

function getStartInputFields(canvasData?: WorkflowCanvasData | null): InputField[] {
  const startNode = canvasData?.nodes.find((node) => (
    isRecord(node) && (node.type === 'start' || node.type === 'input')
  ));

  if (!isRecord(startNode)) {
    return [{ name: 'query', label: 'query', type: 'string' }];
  }

  const data = isRecord(startNode.data) ? startNode.data : {};
  const outputs = Array.isArray(data.outputs) ? data.outputs : [];
  const inputs = Array.isArray(data.inputs) ? data.inputs : [];
  const variables = outputs.length > 0 ? outputs : inputs;

  const fields = variables
    .filter(isRecord)
    .map((variable) => {
      const name = typeof variable.name === 'string' && variable.name.trim()
        ? variable.name.trim()
        : 'query';
      const label = typeof variable.label === 'string' && variable.label.trim()
        ? variable.label.trim()
        : name;
      const type = typeof variable.type === 'string' && variable.type.trim()
        ? variable.type.trim()
        : 'string';

      return { name, label, type };
    });

  return fields.length > 0 ? fields : [{ name: 'query', label: 'query', type: 'string' }];
}

function normalizeInputValue(value: string, type: string) {
  if (type === 'number') {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? value : numberValue;
  }

  if (type === 'boolean') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  if (type === 'object' || type === 'array') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function getStatusColor(status?: string) {
  if (status === 'SUCCEEDED') return 'success';
  if (status === 'FAILED' || status === 'CANCELED') return 'error';
  if (status === 'RUNNING' || status === 'QUEUED') return 'processing';
  return 'default';
}

function createNodeRecordKey(nodeId: string) {
  return `${nodeId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function RunTestPanel({ open, workflowId, canvasData, onClose }: RunTestPanelProps) {
  const [form] = Form.useForm<Record<string, string>>();
  const fields = useMemo(() => getStartInputFields(canvasData), [canvasData]);
  const activeNodeKeyRef = useRef<Record<string, string>>({});
  const runFailedRef = useRef(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonInput, setJsonInput] = useState('{\n  "query": "你好"\n}');
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<WorkflowRunStatus | null>(null);
  const [runOutput, setRunOutput] = useState<Record<string, unknown> | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [nodeRecords, setNodeRecords] = useState<StreamNodeRecord[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialValues = fields.reduce<Record<string, string>>((values, field) => {
      values[field.name] = field.name === 'query' ? '你好' : '';
      return values;
    }, {});

    form.setFieldsValue(initialValues);
    setJsonInput(stringifyJson(initialValues));
    resetRunState();
  }, [fields, form, open]);

  function resetRunState() {
    activeNodeKeyRef.current = {};
    runFailedRef.current = false;
    setRunId(null);
    setRunStatus(null);
    setRunOutput(null);
    setRunError(null);
    setNodeRecords([]);
  }

  function buildInputFromForm() {
    const values = form.getFieldsValue();

    return fields.reduce<Record<string, unknown>>((input, field) => {
      input[field.name] = normalizeInputValue(values[field.name] ?? '', field.type);
      return input;
    }, {});
  }

  function buildRunInput() {
    if (!jsonMode) {
      return buildInputFromForm();
    }

    try {
      const parsed = JSON.parse(jsonInput);
      if (!isRecord(parsed)) {
        throw new Error('运行输入必须是 JSON 对象');
      }

      return parsed;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'JSON 格式不正确');
    }
  }

  function upsertNodeRecord(
    key: string,
    patch: Omit<Partial<StreamNodeRecord>, 'key'> & Pick<StreamNodeRecord, 'nodeId' | 'nodeType'>,
  ) {
    setNodeRecords((records) => {
      const existingIndex = records.findIndex((record) => record.key === key);

      if (existingIndex === -1) {
        return [
          ...records,
          {
            key,
            nodeId: patch.nodeId,
            nodeType: patch.nodeType,
            status: patch.status ?? 'PENDING',
            input: patch.input ?? null,
            output: patch.output ?? null,
            errorMessage: patch.errorMessage ?? null,
            durationMs: patch.durationMs ?? null,
          },
        ];
      }

      return records.map((record, index) => (
        index === existingIndex
          ? {
              ...record,
              ...patch,
              input: patch.input !== undefined ? patch.input : record.input,
              output: patch.output !== undefined ? patch.output : record.output,
              errorMessage: patch.errorMessage !== undefined ? patch.errorMessage : record.errorMessage,
              durationMs: patch.durationMs !== undefined ? patch.durationMs : record.durationMs,
            }
          : record
      ));
    });
  }

  function getActiveNodeKey(nodeId: string) {
    return activeNodeKeyRef.current[nodeId] ?? createNodeRecordKey(nodeId);
  }

  function handleStreamEvent(event: WorkflowStreamEvent) {
    if (event.type === 'run.created') {
      setRunId(event.runId);
      setRunStatus('RUNNING');
      return;
    }

    if (event.type === 'node.started') {
      const key = createNodeRecordKey(event.nodeId);
      activeNodeKeyRef.current[event.nodeId] = key;
      upsertNodeRecord(key, {
        nodeId: event.nodeId,
        nodeType: event.nodeType,
        status: 'RUNNING',
        input: event.input ?? null,
      });
      return;
    }

    if (event.type === 'node.completed') {
      const key = getActiveNodeKey(event.nodeId);
      delete activeNodeKeyRef.current[event.nodeId];
      upsertNodeRecord(key, {
        nodeId: event.nodeId,
        nodeType: event.nodeType,
        status: 'SUCCEEDED',
        input: event.input,
        output: event.output ?? null,
        durationMs: event.durationMs ?? null,
      });
      return;
    }

    if (event.type === 'node.failed') {
      const key = getActiveNodeKey(event.nodeId);
      delete activeNodeKeyRef.current[event.nodeId];
      upsertNodeRecord(key, {
        nodeId: event.nodeId,
        nodeType: event.nodeType,
        status: 'FAILED',
        input: event.input,
        errorMessage: event.errorMessage ?? '节点运行失败',
        durationMs: event.durationMs ?? null,
      });
      return;
    }

    if (event.type === 'run.completed') {
      setRunId(event.runId);
      setRunStatus('SUCCEEDED');
      setRunOutput(event.output ?? {});
      return;
    }

    if (event.type === 'run.failed') {
      const errorMessage = event.errorMessage ?? event.error ?? '工作流运行失败';
      runFailedRef.current = true;
      setRunId(event.runId);
      setRunStatus('FAILED');
      setRunError(errorMessage);
      activeNodeKeyRef.current = {};
      setNodeRecords((records) => records.map((record) => (
        record.status === 'RUNNING'
          ? { ...record, status: 'FAILED', errorMessage }
          : record
      )));
      return;
    }

    if (event.type === 'stream.done') {
      setRunId(event.runId);
    }
  }

  async function handleRun() {
    if (!canvasData) {
      message.warning('当前画布数据为空');
      return;
    }

    let input: Record<string, unknown>;

    try {
      input = buildRunInput();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '运行输入格式不正确');
      return;
    }

    setRunning(true);
    resetRunState();
    setRunStatus('RUNNING');

    try {
      const runnableDefinition = toRunnableWorkflowDefinition(canvasData);
      await saveWorkflowDraftRemote(workflowId, runnableDefinition, { rawDefinition: true });
      await runWorkflowStreamRemote(workflowId, { input }, handleStreamEvent);

      if (runFailedRef.current) {
        message.error('试运行失败');
      } else {
        message.success('试运行成功');
      }
    } catch (error) {
      console.error(error);
      runFailedRef.current = true;
      setRunStatus('FAILED');
      setRunError(error instanceof Error ? error.message : '试运行失败');
      message.error(error instanceof Error ? error.message : '试运行失败，请稍后重试');
    } finally {
      await saveWorkflowDraftRemote(workflowId, canvasData).catch((error) => {
        console.error('Restore workflow canvas draft failed:', error);
      });
      setRunning(false);
    }
  }

  return (
    <Drawer
      title={
        <div className={styles.titleRow}>
          <span className={styles.title}>试运行</span>
          {runStatus && <Tag color={getStatusColor(runStatus)}>{runStatus}</Tag>}
        </div>
      }
      open={open}
      width={432}
      onClose={onClose}
      destroyOnHidden
      mask={false}
      className={styles.drawer}
      rootClassName={styles.drawerRoot}
    >
      <div className={styles.result}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>试运行输入</span>
            <Space size={8}>
              <span>JSON 模式</span>
              <Switch size="small" checked={jsonMode} onChange={setJsonMode} />
            </Space>
          </div>

          {jsonMode ? (
            <Input.TextArea
              className={styles.jsonInput}
              rows={8}
              value={jsonInput}
              onChange={(event) => setJsonInput(event.target.value)}
            />
          ) : (
            <Form form={form} layout="vertical">
              {fields.map((field) => (
                <Form.Item
                  key={field.name}
                  label={
                    <span>
                      {field.label} <Typography.Text type="secondary">{field.type}</Typography.Text>
                    </span>
                  }
                  name={field.name}
                >
                  <Input placeholder={`请输入${field.label}`} />
                </Form.Item>
              ))}
            </Form>
          )}
        </div>

        {runId && (
          <div className={styles.resultBlock}>
            <div className={styles.nodeMeta}>Run ID: {runId}</div>
          </div>
        )}

        {runError && (
          <Alert
            showIcon
            type="error"
            message="运行失败"
            description={runError}
            className={styles.resultBlock}
          />
        )}

        {(runOutput || nodeRecords.length > 0) && (
          <>
            {runOutput && (
              <div className={styles.resultBlock}>
                <div className={styles.sectionTitle}>最终输出</div>
                <pre className={styles.pre}>{stringifyJson(runOutput)}</pre>
              </div>
            )}

            <div className={styles.resultBlock}>
              <div className={styles.sectionTitle}>节点执行记录</div>
              <div className={styles.nodeList}>
                {nodeRecords.map((node) => (
                  <details
                    className={`${styles.nodeItem} ${node.status === 'FAILED' ? styles.nodeItemFailed : ''}`}
                    key={node.key}
                    open={node.status === 'FAILED'}
                  >
                    <summary className={styles.nodeSummary}>
                      <div className={styles.nodeInfo}>
                        <span className={styles.nodeName}>
                          {getNodeTitle(canvasData, node.nodeId, node.nodeType)}
                        </span>
                        <span className={styles.nodeMeta}>
                          {node.nodeType} · {formatDuration(node.durationMs)}
                        </span>
                      </div>
                      <Tag color={getStatusColor(node.status)}>{node.status}</Tag>
                    </summary>

                    <div className={styles.nodeDebug}>
                      <div className={styles.debugBlock}>
                        <div className={styles.debugLabel}>Input</div>
                        <pre className={styles.pre}>{stringifyJson(node.input)}</pre>
                      </div>

                      <div className={styles.debugBlock}>
                        <div className={styles.debugLabel}>Output</div>
                        <pre className={styles.pre}>{stringifyJson(node.output)}</pre>
                      </div>

                      {node.errorMessage && (
                        <div className={styles.debugBlock}>
                          <div className={styles.debugLabel}>Error</div>
                          <Alert
                            showIcon
                            type="error"
                            message={node.errorMessage}
                          />
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <Button
          className={styles.runButton}
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={running}
          onClick={handleRun}
        >
          试运行
        </Button>
      </div>
    </Drawer>
  );
}

export default RunTestPanel;
