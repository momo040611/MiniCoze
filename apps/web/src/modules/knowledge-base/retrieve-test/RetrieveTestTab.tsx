import { Button, Card, Form, Input, InputNumber, List, Progress, Select, Space, Switch, Tag, Typography } from 'antd';
import { RetrievalMode } from '../../../api/knowledge-base';
import { retrievalModeText } from '../components/labels';
import { useRetrievalTest } from '../hooks/useRetrievalTest';
import styles from '../document/document.module.css';

type RetrieveTestTabProps = {
  knowledgeBaseId: string;
};

type RetrieveFormValues = {
  query: string;
  retrievalMode: RetrievalMode;
  hybridEnabled: boolean;
  topK: number;
  scoreThreshold: number;
  rerankEnabled: boolean;
  metadataFilterText?: string;
};

function parseFilter(value?: string) {
  if (!value?.trim()) return undefined;
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, line) => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length > 0) result[key.trim()] = rest.join('=').trim();
      return result;
    }, {});
}

function RetrieveTestTab({ knowledgeBaseId }: RetrieveTestTabProps) {
  const { loading, results, history, run, setResults } = useRetrievalTest(knowledgeBaseId);

  const runTest = async (values: RetrieveFormValues) => {
    await run({
      query: values.query,
      retrievalMode: values.hybridEnabled ? values.retrievalMode : RetrievalMode.Vector,
      topK: values.topK,
      scoreThreshold: values.scoreThreshold,
      rerankEnabled: values.rerankEnabled,
      metadataFilter: parseFilter(values.metadataFilterText),
    });
  };

  const bestScore = results[0]?.score ?? 0;

  return (
    <div className={styles.twoColumn}>
      <Space direction="vertical" size={16}>
        <Card title="检索测试配置">
          <Form<RetrieveFormValues>
            layout="vertical"
            initialValues={{
              query: '',
              retrievalMode: RetrievalMode.Hybrid,
              hybridEnabled: true,
              topK: 5,
              scoreThreshold: 0.35,
              rerankEnabled: true,
            }}
            onFinish={runTest}
          >
            <Form.Item label="Query" name="query" rules={[{ required: true, message: '请输入测试问题' }]}>
              <Input.TextArea rows={4} placeholder="例如：如何把 Agent 绑定到知识库？" />
            </Form.Item>
            <Form.Item label="检索方式" name="retrievalMode">
              <Select
                options={[
                  { value: RetrievalMode.Vector, label: retrievalModeText[RetrievalMode.Vector] },
                  { value: RetrievalMode.FullText, label: retrievalModeText[RetrievalMode.FullText] },
                  { value: RetrievalMode.Hybrid, label: retrievalModeText[RetrievalMode.Hybrid] },
                ]}
              />
            </Form.Item>
            <Form.Item label="Hybrid Search" name="hybridEnabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="Top K" name="topK">
              <InputNumber min={1} max={20} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Score Threshold" name="scoreThreshold">
              <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="Rerank" name="rerankEnabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="元数据过滤（每行 key=value）" name="metadataFilterText">
              <Input.TextArea rows={3} placeholder="category=产品" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              开始测试
            </Button>
          </Form>
        </Card>
        <Card title="历史测试记录">
          <List
            size="small"
            dataSource={history.slice(0, 8)}
            locale={{ emptyText: '暂无历史记录' }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button key="view" type="link" onClick={() => setResults(item.results ?? [])}>
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={item.query}
                  description={`${retrievalModeText[item.retrievalMode]} · ${item.resultCount} 条 · ${item.latencyMs}ms · ${item.createdAt}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </Space>

      <Card
        title="召回结果"
        extra={
          <Space>
            <Tag color="blue">{results.length} chunks</Tag>
            <Tag color={bestScore > 0.7 ? 'green' : bestScore > 0.35 ? 'gold' : 'default'}>Best {bestScore.toFixed(3)}</Tag>
          </Space>
        }
      >
        <List
          dataSource={results}
          locale={{ emptyText: '暂无检索结果' }}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color="blue">Rank {item.rank}</Tag>
                  <Tag>Score {item.score}</Tag>
                  {item.vectorDistance !== undefined ? <Tag>Distance {item.vectorDistance}</Tag> : null}
                  {item.rerankScore !== undefined ? <Tag color="purple">Rerank {item.rerankScore}</Tag> : null}
                  <Tag>{item.documentName}</Tag>
                </Space>
                <Progress percent={Math.round(item.score * 100)} size="small" />
                <Typography.Paragraph style={{ marginBottom: 0 }}>{item.chunkContent}</Typography.Paragraph>
                <div className={styles.tagRow}>
                  {item.matchedBy?.map((value) => <Tag key={value}>{value}</Tag>)}
                  {item.tokenCount ? <Tag>{item.tokenCount} tokens</Tag> : null}
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <Tag key={key}>
                      {key}: {String(value)}
                    </Tag>
                  ))}
                </div>
              </Space>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}

export { RetrieveTestTab };
