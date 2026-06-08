import { useState } from 'react';
import { Card, Tag, Typography, Collapse, Empty } from 'antd';
import { BookOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface RetrievalChunk {
  id: string;
  content: string;
  score: number;
  documentName: string;
  metadata?: Record<string, unknown>;
}

interface KnowledgeRetrievalPreviewProps {
  knowledgeName: string;
  chunks: RetrievalChunk[];
  query?: string;
  loading?: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const percent = Math.round(score * 100);
  let color = '#52c41a';
  if (percent < 60) color = '#faad14';
  if (percent < 40) color = '#ff4d4f';

  return (
    <Tag
      color={color}
      style={{
        borderRadius: 12,
        fontSize: 11,
        padding: '0 8px',
        lineHeight: '20px',
      }}
    >
      相关度 {percent}%
    </Tag>
  );
}

export function KnowledgeRetrievalPreview({
  knowledgeName,
  chunks,
  query,
  loading = false,
}: KnowledgeRetrievalPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <Card
        size="small"
        style={{ marginBottom: 12, borderRadius: 12, border: '1px solid #f0f0f0' }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOutlined style={{ color: '#faad14' }} />
          <Text type="secondary" style={{ fontSize: 13 }}>
            正在检索知识库「{knowledgeName}」...
          </Text>
        </div>
      </Card>
    );
  }

  if (chunks.length === 0) {
    return null;
  }

  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        borderRadius: 12,
        border: '1px solid rgba(86, 95, 226, 0.15)',
        background: 'rgba(86, 95, 226, 0.02)',
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <BookOutlined style={{ color: '#565fe2' }} />
        <Text strong style={{ fontSize: 13 }}>
          知识库「{knowledgeName}」检索结果
        </Text>
        <Tag color="blue" style={{ marginLeft: 'auto', borderRadius: 10, fontSize: 11 }}>
          {chunks.length} 条匹配
        </Tag>
      </div>

      {query && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <SearchOutlined style={{ color: '#8896a6', fontSize: 12 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            查询：{query}
          </Text>
        </div>
      )}

      <Collapse
        ghost
        size="small"
        activeKey={expanded ? ['chunks'] : []}
        onChange={(keys) => setExpanded(keys.includes('chunks'))}
        items={[
          {
            key: 'chunks',
            label: (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {expanded ? '收起详情' : '展开查看检索片段'}
              </Text>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {chunks.map((chunk, index) => (
                  <div
                    key={chunk.id}
                    style={{
                      padding: '10px 12px',
                      background: '#fff',
                      borderRadius: 8,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <FileTextOutlined style={{ color: '#8896a6', fontSize: 12 }} />
                      <Text style={{ fontSize: 12, color: '#506070' }}>
                        {chunk.documentName}
                      </Text>
                      <ScoreBadge score={chunk.score} />
                    </div>
                    <Paragraph
                      style={{
                        fontSize: 13,
                        lineHeight: 1.6,
                        margin: 0,
                        color: '#18202f',
                      }}
                      ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                    >
                      {chunk.content}
                    </Paragraph>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
