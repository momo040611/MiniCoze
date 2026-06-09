// 智能体发布面板 — 展示所有智能体及发布/下线操作
// 增强版：版本历史、发布记录、渠道配置、回滚

import { useEffect, useState } from 'react';
import {
  Table, Tag, Button, Space, App, Modal, Input, Tooltip,
  Tabs, Timeline, Typography, Collapse, Switch,
} from 'antd';
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
  RollbackOutlined,
  LinkOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getAgentList,
  checkAgent,
  publishAgent,
  offlineAgent,
  getAgentVersions,
  getAgentRecords,
  rollbackAgent,
  listAgentChannels,
  rotateApiKey,
  enableAgentChannel,
  disableAgentChannel,
  type AgentItem,
  type PublishCheckItem,
  type AgentVersionItem,
  type PublishRecordItem,
  type PublishChannelResponse,
  type WebPublishChannelConfig,
  type ApiPublishChannelConfig,
} from '../api';
import styles from '../index.module.css';

const { Text } = Typography;

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: '草稿' },
  ACTIVE: { color: 'green', label: '已发布' },
  ARCHIVED: { color: 'red', label: '已归档' },
};

const RECORD_ACTION_LABEL: Record<string, string> = {
  PUBLISH: '发布',
  OFFLINE: '下线',
  ROLLBACK: '回滚',
};

const RECORD_ACTION_COLOR: Record<string, string> = {
  PUBLISH: 'green',
  OFFLINE: 'red',
  ROLLBACK: 'orange',
};

/** 从 HTTP 错误中提取可读信息 */
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    if (e.data && typeof e.data === 'object') {
      const d = e.data as Record<string, unknown>;
      if (typeof d.message === 'string') return d.message;
    }
    if (typeof e.status === 'number' && e.status >= 400) {
      return `请求失败 (${e.status})`;
    }
  }
  return '操作失败，请稍后重试';
}

export function AgentPublishPanel() {
  const { message, modal } = App.useApp();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // 检查发布弹窗
  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const [checkItems, setCheckItems] = useState<PublishCheckItem[]>([]);
  const [checkTarget, setCheckTarget] = useState<AgentItem | null>(null);
  const [changelog, setChangelog] = useState('');

  // 详情面板（展开行数据）
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  // 展开行的 Tab 数据
  const [versions, setVersions] = useState<AgentVersionItem[]>([]);
  const [records, setRecords] = useState<PublishRecordItem[]>([]);
  const [channels, setChannels] = useState<PublishChannelResponse[]>([]);

  // API Key 展示（仅生成时显示一次）
  const [displayedKey, setDisplayedKey] = useState<string | null>(null);
  const [keyRotating, setKeyRotating] = useState(false);

  // 回滚弹窗
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<AgentVersionItem | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollingBack, setRollingBack] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const list = await getAgentList();
      setAgents(list);
    } catch (err) {
      message.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  // 加载展开行数据
  const loadExpandedData = async (agent: AgentItem) => {
    setExpandLoading(true);
    try {
      const [v, r, c] = await Promise.all([
        getAgentVersions(agent.id).catch(() => [] as AgentVersionItem[]),
        getAgentRecords(agent.id).catch(() => [] as PublishRecordItem[]),
        listAgentChannels(agent.id).catch(() => [] as PublishChannelResponse[]),
      ]);
      setVersions(v);
      setRecords(r);
      setChannels(c);
    } catch {
      // 各子请求已独立 catch
    } finally {
      setExpandLoading(false);
    }
  };

  const handleExpand = (expanded: boolean, record: AgentItem) => {
    if (expanded) {
      setExpandedId(record.id);
      setDisplayedKey(null);
      loadExpandedData(record);
    } else {
      setExpandedId(null);
    }
  };

  const handlePreCheck = async (agent: AgentItem) => {
    try {
      const result = await checkAgent(agent.id);
      setCheckItems(result.items);
      setCheckTarget(agent);
      setChangelog('');
      setCheckModalOpen(true);
    } catch (err) {
      message.error(extractErrorMessage(err));
    }
  };

  const handleConfirmPublish = async () => {
    if (!checkTarget) return;
    setPublishingId(checkTarget.id);
    try {
      await publishAgent(checkTarget.id, changelog || undefined);
      message.success(`「${checkTarget.name}」发布成功`);
      setCheckModalOpen(false);
      await fetchAgents();
      // 刷新如果有展开行
      if (expandedId === checkTarget.id) {
        loadExpandedData(checkTarget);
      }
    } catch (err) {
      message.error(extractErrorMessage(err));
    } finally {
      setPublishingId(null);
    }
  };

  const handleOffline = (agent: AgentItem) => {
    modal.confirm({
      title: `确认取消发布「${agent.name}」？`,
      content: '取消发布后所有发布渠道将被禁用。',
      okText: '确认取消发布',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await offlineAgent(agent.id);
          message.success(`「${agent.name}」已取消发布`);
          await fetchAgents();
          if (expandedId === agent.id) {
            loadExpandedData(agent);
          }
        } catch (err) {
          message.error(extractErrorMessage(err));
        }
      },
    });
  };

  // 回滚
  const handleRollback = (version: AgentVersionItem) => {
    setRollbackTarget(version);
    setRollbackReason('');
    setRollbackModalOpen(true);
  };

  const confirmRollback = async () => {
    if (!rollbackTarget || !expandedId) return;
    setRollingBack(true);
    try {
      await rollbackAgent(expandedId, rollbackTarget.id, rollbackReason || undefined);
      message.success(`已回滚到版本 v${rollbackTarget.version}`);
      setRollbackModalOpen(false);
      await fetchAgents();
      loadExpandedData({ id: expandedId } as AgentItem);
    } catch (err) {
      message.error(extractErrorMessage(err));
    } finally {
      setRollingBack(false);
    }
  };

  // 渠道操作
  const handleToggleChannel = async (agentId: string, channel: PublishChannelResponse) => {
    try {
      if (channel.enabled) {
        await disableAgentChannel(agentId, channel.channel);
      } else {
        await enableAgentChannel(agentId, channel.channel);
      }
      // 刷新渠道列表
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id ? { ...c, enabled: !c.enabled } : c,
        ),
      );
    } catch (err) {
      message.error(extractErrorMessage(err));
    }
  };

  const handleRotateKey = async (agentId: string) => {
    setKeyRotating(true);
    try {
      const result = await rotateApiKey(agentId);
      setDisplayedKey(result.apiKey);
      message.success('API Key 已重新生成，请立即复制保存');
      // 刷新渠道
      const updated = await listAgentChannels(agentId);
      setChannels(updated);
    } catch (err) {
      message.error(extractErrorMessage(err));
    } finally {
      setKeyRotating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const columns: ColumnsType<AgentItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space>
          <span>{name}</span>
          {record.description && (
            <Tooltip title={record.description}>
              <span className={styles.panelDesc}>
                {record.description.slice(0, 30)}
                {(record.description.length > 30) ? '...' : ''}
              </span>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = STATUS_MAP[status] ?? { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.status !== 'ACTIVE' && (
            <Button
              size="small"
              className={styles.btnPrimary}
              icon={<CloudUploadOutlined />}
              onClick={() => handlePreCheck(record)}
            >
              发布
            </Button>
          )}
          {record.status === 'ACTIVE' && (
            <Button
              size="small"
              className={styles.btnOutline}
              icon={<CloudDownloadOutlined />}
              onClick={() => handleOffline(record)}
            >
              取消发布
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 展开行内容
  const expandedRowRender = (record: AgentItem) => {
    const isExpanded = record.id === expandedId;

    if (!isExpanded) return null;

    const webChannel = channels.find((c) => c.channel === 'WEB');
    const apiChannel = channels.find((c) => c.channel === 'API');
    const webConfig = webChannel?.config as WebPublishChannelConfig | undefined;
    const apiConfig = apiChannel?.config as ApiPublishChannelConfig | undefined;

    const tabItems = [
      {
        key: 'versions',
        label: `版本历史 (${versions.length})`,
        children: (
          <div className={styles.expandSection}>
            {versions.length === 0 ? (
              <div className={styles.panelEmpty}>暂无发布版本</div>
            ) : (
              <div className={styles.versionList}>
                {[...versions]
                  .sort((a, b) => b.version - a.version)
                  .map((v) => (
                    <div
                      key={v.id}
                      className={`${styles.versionItem} ${v.isCurrent ? styles.versionCurrent : ''}`}
                    >
                      <div className={styles.versionInfo}>
                        <Space>
                          <Text strong>v{v.version}</Text>
                          {v.isCurrent && <Tag color="blue">当前</Tag>}
                        </Space>
                        <Text type="secondary" className={styles.versionTime}>
                          {v.publishedAt
                            ? new Date(v.publishedAt).toLocaleString('zh-CN')
                            : new Date(v.createdAt).toLocaleString('zh-CN')}
                        </Text>
                      </div>
                      <div className={styles.versionMeta}>
                        {v.changelog && (
                          <Text type="secondary" className={styles.changelog}>
                            {v.changelog}
                          </Text>
                        )}
                        {v.createdBy?.username && (
                          <Text type="secondary">
                            操作人：{v.createdBy.username}
                          </Text>
                        )}
                      </div>
                      {!v.isCurrent && (
                        <Button
                          size="small"
                          icon={<RollbackOutlined />}
                          onClick={() => handleRollback(v)}
                          danger
                        >
                          回滚到此版本
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'records',
        label: `发布记录 (${records.length})`,
        children: (
          <div className={styles.expandSection}>
            {records.length === 0 ? (
              <div className={styles.panelEmpty}>暂无发布记录</div>
            ) : (
              <Timeline
                items={records.map((r) => ({
                  color: RECORD_ACTION_COLOR[r.action] || 'gray',
                  content: (
                    <div>
                      <Space>
                        <Tag color={RECORD_ACTION_COLOR[r.action]}>
                          {RECORD_ACTION_LABEL[r.action] || r.action}
                        </Tag>
                        {r.version && <Text>v{r.version}</Text>}
                      </Space>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(r.createdAt).toLocaleString('zh-CN')}
                        {r.operatorName && ` · ${r.operatorName}`}
                      </Text>
                      {r.reason && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {r.reason}
                          </Text>
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            )}
          </div>
        ),
      },
      {
        key: 'channels',
        label: '发布渠道',
        children: (
          <div className={styles.expandSection}>
            {channels.length === 0 ? (
              <div className={styles.panelEmpty}>暂无渠道配置（发布后自动创建）</div>
            ) : (
              <Collapse
                size="small"
                items={[
                  {
                    key: 'web',
                    label: (
                      <Space>
                        <LinkOutlined />
                        <span>WEB 渠道</span>
                        <Switch
                          size="small"
                          checked={webChannel?.enabled ?? false}
                          onChange={() =>
                            webChannel && handleToggleChannel(record.id, webChannel)
                          }
                          onClick={(_, e) => e.stopPropagation()}
                        />
                      </Space>
                    ),
                    children: webConfig ? (
                      <div className={styles.channelConfig}>
                        <div className={styles.configRow}>
                          <Text type="secondary">标识 (slug)：</Text>
                          <Space>
                            <Text code>{webConfig.slug}</Text>
                            <CopyOutlined
                              className={styles.copyIcon}
                              onClick={() => copyToClipboard(webConfig.slug)}
                            />
                          </Space>
                        </div>
                        {webConfig.publicPath && (
                          <div className={styles.configRow}>
                            <Text type="secondary">公开访问：</Text>
                            <Space>
                              <Text code className={styles.linkText}>
                                {webConfig.publicPath}
                              </Text>
                              <CopyOutlined
                                className={styles.copyIcon}
                                onClick={() => copyToClipboard(webConfig.publicPath)}
                              />
                            </Space>
                          </div>
                        )}
                        {webConfig.publicPath && (
                          <div style={{ marginTop: 4 }}>
                            <Space>
                              <Button
                                size="small"
                                type="primary"
                                icon={<CopyOutlined />}
                                onClick={() => {
                                  const shareUrl = `${window.location.origin}/share/agents/${webConfig.slug}`;
                                  copyToClipboard(shareUrl);
                                }}
                              >
                                一键复制分享链接
                              </Button>
                              <Button
                                size="small"
                                icon={<LinkOutlined />}
                                onClick={() => {
                                  window.open(`/share/agents/${webConfig.slug}`, '_blank');
                                }}
                              >
                                打开分享页面
                              </Button>
                            </Space>
                          </div>
                        )}
                        {webConfig.embedPath && (
                          <div className={styles.configRow}>
                            <Text type="secondary">嵌入地址：</Text>
                            <Space>
                              <Text code className={styles.linkText}>
                                {webConfig.embedPath}
                              </Text>
                              <CopyOutlined
                                className={styles.copyIcon}
                                onClick={() => copyToClipboard(webConfig.embedPath)}
                              />
                            </Space>
                          </div>
                        )}
                        <div className={styles.configRow}>
                          <Text type="secondary">匿名访问：</Text>
                          <Text>{webConfig.allowAnonymous ? '允许' : '禁止'}</Text>
                        </div>
                        <div className={styles.configRow}>
                          <Text type="secondary">主题：</Text>
                          <Text>{webConfig.theme}</Text>
                        </div>
                      </div>
                    ) : null,
                  },
                  {
                    key: 'api',
                    label: (
                      <Space>
                        <ApiOutlined />
                        <span>API 渠道</span>
                        <Switch
                          size="small"
                          checked={apiChannel?.enabled ?? false}
                          onChange={() =>
                            apiChannel && handleToggleChannel(record.id, apiChannel)
                          }
                          onClick={(_, e) => e.stopPropagation()}
                        />
                      </Space>
                    ),
                    children: apiConfig ? (
                      <div className={styles.channelConfig}>
                        {apiConfig.apiKeyPrefix && (
                          <div className={styles.configRow}>
                            <Text type="secondary">API Key 前缀：</Text>
                            <Text code>{apiConfig.apiKeyPrefix}****</Text>
                          </div>
                        )}
                        {displayedKey && (
                          <div className={styles.configRow}>
                            <Text type="secondary">完整 Key：</Text>
                            <Space>
                              <Text code className={styles.apiKeyText}>
                                {displayedKey}
                              </Text>
                              <CopyOutlined
                                className={styles.copyIcon}
                                onClick={() => copyToClipboard(displayedKey)}
                              />
                            </Space>
                          </div>
                        )}
                        <Button
                          size="small"
                          icon={<ReloadOutlined />}
                          loading={keyRotating}
                          onClick={() => handleRotateKey(record.id)}
                          style={{ marginBottom: 8 }}
                        >
                          重新生成 API Key
                        </Button>
                        <div className={styles.configRow}>
                          <Text type="secondary">每分钟限流：</Text>
                          <Text>{apiConfig.rateLimitPerMinute} 次</Text>
                        </div>
                        <div className={styles.configRow}>
                          <Text type="secondary">每天限流：</Text>
                          <Text>{apiConfig.rateLimitPerDay} 次</Text>
                        </div>

                        {/* API 调用说明文档 */}
                        <div className={styles.apiUsage}>
                          <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
                            <ApiOutlined /> API 调用说明
                          </Text>

                          <div className={styles.codeBlock}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <strong>调用方式：</strong>通过 HTTPS POST 请求发送消息到智能体，支持流式（SSE）和非流式两种模式。
                            </Text>
                          </div>

                          <div className={styles.codeBlock}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <strong>接口地址：</strong>
                            </Text>
                            <pre className={styles.preCode}>
{`POST /api/public/agents/${webConfig?.slug ?? '{slug}'}/stream`}
</pre>
                          </div>

                          <div className={styles.codeBlock}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <strong>认证方式：</strong>在请求头中携带 <Text code>Authorization: Bearer {'{API_KEY}'}</Text>
                            </Text>
                          </div>

                          <div className={styles.codeBlock}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <strong>请求体：</strong>
                            </Text>
                            <pre className={styles.preCode}>
{`{
  "message": "你好，请帮我...",
  "conversationId": "可选，用于多轮对话"
}`}
</pre>
                          </div>

                          <div className={styles.codeBlock}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <strong>SSE 事件类型：</strong>
                            </Text>
                            <pre className={styles.preCode}>
{`event: run.created        → 运行已创建，返回 runId / conversationId
event: message.delta       → 流式文本增量输出
event: message.completed   → 消息生成完成
event: tool.call.created   → 工具调用开始
event: tool.call.completed → 工具调用结束（含结果）
event: run.completed       → 运行完成（含 token 用量）
event: run.failed          → 运行失败（含错误信息）
event: stream.done         → 流结束`}
</pre>
                          </div>

                          <div className={styles.codeBlock}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <strong>使用规则：</strong>
                            </Text>
                            <ul style={{ fontSize: 12, color: '#7b8ba3', paddingLeft: 18, margin: '4px 0' }}>
                              <li>所有请求必须携带有效的 API Key，否则返回 401。</li>
                              <li>建议使用 SSE 流式模式以获得更好的用户体验。</li>
                              <li>每次对话可通过 <Text code>conversationId</Text> 维持多轮上下文。</li>
                              <li>遵守限流规则：{apiConfig.rateLimitPerMinute} 次/分钟，{apiConfig.rateLimitPerDay} 次/天。</li>
                              <li>API Key 仅生成时完整显示一次，请妥善保管。</li>
                            </ul>
                          </div>

                          <Collapse
                            size="small"
                            ghost
                            items={[
                              {
                                key: 'curl',
                                label: <Text style={{ fontSize: 12 }}>cURL 示例</Text>,
                                children: (
                                  <pre className={styles.preCode}>
{`curl -X POST \\
  "https://{host}/api/public/agents/${webConfig?.slug ?? '{slug}'}/stream" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "你好，请介绍一下自己"}' \\
  --no-buffer`}
</pre>
                                ),
                              },
                              {
                                key: 'python',
                                label: <Text style={{ fontSize: 12 }}>Python 示例</Text>,
                                children: (
                                  <pre className={styles.preCode}>
{`import requests
import json

url = "https://{host}/api/public/agents/${webConfig?.slug ?? '{slug}'}/stream"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
data = {"message": "你好，请介绍一下自己"}

response = requests.post(url, headers=headers, json=data, stream=True)

for line in response.iter_lines():
    if line:
        line = line.decode("utf-8")
        if line.startswith("data:"):
            event = json.loads(line[5:])
            if event["type"] == "message.delta":
                print(event["content"], end="", flush=True)`}
</pre>
                                ),
                              },
                              {
                                key: 'javascript',
                                label: <Text style={{ fontSize: 12 }}>JavaScript 示例</Text>,
                                children: (
                                  <pre className={styles.preCode}>
{`// 使用 fetch + ReadableStream 处理 SSE
const response = await fetch(
  "https://{host}/api/public/agents/${webConfig?.slug ?? '{slug}'}/stream",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "你好" })
  }
);

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // 按 SSE 协议解析 buffer...
}`}
</pre>
                                ),
                              },
                            ]}
                          />
                        </div>
                      </div>
                    ) : null,
                  },
                ]}
              />
            )}
          </div>
        ),
      },
    ];

    return (
      <div className={styles.expandContent}>
        {expandLoading ? (
          <div className={styles.panelEmpty}>加载中...</div>
        ) : (
          <Tabs items={tabItems} size="small" />
        )}
      </div>
    );
  };

  return (
    <div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={agents}
        loading={loading}
        pagination={false}
        locale={{ emptyText: '暂无智能体' }}
        expandable={{
          expandedRowRender,
          expandedRowKeys: expandedId ? [expandedId] : [],
          onExpand: handleExpand,
        }}
      />

      {/* 发布检查弹窗 */}
      <Modal
        title={`发布检查 — ${checkTarget?.name ?? ''}`}
        open={checkModalOpen}
        onCancel={() => setCheckModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCheckModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="publish"
            type="primary"
            loading={!!publishingId}
            disabled={checkItems.length === 0 || checkItems.some((i) => !i.passed)}
            onClick={handleConfirmPublish}
          >
            确认发布
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          {checkItems.map((item) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
              }}
            >
              {item.passed ? (
                <CheckCircleOutlined style={{ color: '#16a34a' }} />
              ) : (
                <ExclamationCircleOutlined style={{ color: '#dc2626' }} />
              )}
              <span>{item.label}</span>
              {item.message && (
                <span style={{ color: '#8896a6', fontSize: 12 }}>
                  {item.message}
                </span>
              )}
            </div>
          ))}
        </div>
        <Input.TextArea
          placeholder="发布说明（可选）"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          rows={2}
          maxLength={500}
          showCount
        />
      </Modal>

      {/* 回滚确认弹窗 */}
      <Modal
        title="确认回滚"
        open={rollbackModalOpen}
        onCancel={() => setRollbackModalOpen(false)}
        onOk={confirmRollback}
        confirmLoading={rollingBack}
        okText="确认回滚"
        okType="danger"
        cancelText="取消"
      >
        <p>
          确认回滚到版本 <Text strong>v{rollbackTarget?.version}</Text>？
        </p>
        <p style={{ color: '#8896a6', fontSize: 13 }}>
          回滚后将创建一个新版本，恢复该版本的快照配置。当前版本不会丢失，仍可在版本历史中查看。
        </p>
        <Input.TextArea
          placeholder="回滚原因（可选）"
          value={rollbackReason}
          onChange={(e) => setRollbackReason(e.target.value)}
          rows={2}
          maxLength={500}
        />
      </Modal>
    </div>
  );
}
