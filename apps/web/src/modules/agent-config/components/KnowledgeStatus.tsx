import { useState } from 'react';
import { Alert, Collapse, Tag, Typography } from 'antd';
import { BookOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface KnowledgeInfo {
  bound: boolean;
  knowledgeName?: string;
  retrievedCount?: number;
}

interface RetrievalChunk {
  id: string;
  content: string;
  score: number;
  documentName: string;
}

interface Props {
  knowledgeEvent: { type: string; runId: string; knowledge: KnowledgeInfo } | null;
  onClose: () => void;
  retrievalChunks?: RetrievalChunk[];
}

export function KnowledgeStatus({ knowledgeEvent, onClose, retrievalChunks }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  if (!knowledgeEvent) return null;

  const { knowledge } = knowledgeEvent;

  if (!knowledge.bound) {
    return (
      <Alert
        type="info"
        icon={<InfoCircleOutlined />}
        message={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOutlined />
            <span>未绑定知识库，调试结果不包含知识检索</span>
          </span>
        }
        action={
          <a style={{ whiteSpace: 'nowrap', fontSize: 12 }} href="/knowledge-bases">
            去配置 →
          </a>
        }
        closable
        onClose={onClose}
        style={{
          marginBottom: 0,
          borderRadius: 0,
          borderLeft: 0,
          borderRight: 0,
          animation: 'fadeIn 0.3s ease',
        }}
      />
    );
  }

  if (knowledge.retrievedCount === 0) {
    return (
      <Alert
        type="warning"
        icon={<WarningOutlined />}
        message={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOutlined />
            <span>知识库「{knowledge.knowledgeName}」未检索到相关内容</span>
            <Tag color="warning" style={{ marginLeft: 4 }}>0 条匹配</Tag>
          </span>
        }
        description="请检查知识库是否有内容，或尝试调整检索关键词"
        closable
        onClose={onClose}
        style={{
          marginBottom: 0,
          borderRadius: 0,
          borderLeft: 0,
          borderRight: 0,
          animation: 'fadeIn 0.3s ease',
        }}
      />
    );
  }

  if (knowledge.retrievedCount !== undefined && knowledge.retrievedCount > 0) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          message={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOutlined />
              <span>从知识库「{knowledge.knowledgeName}」检索到相关内容</span>
              <Tag color="success" style={{ marginLeft: 4 }}>
                {knowledge.retrievedCount} 条匹配
              </Tag>
            </span>
          }
          closable
          onClose={onClose}
          style={{
            marginBottom: 0,
            borderRadius: 0,
            borderLeft: 0,
            borderRight: 0,
          }}
        />
        {retrievalChunks && retrievalChunks.length > 0 && (
          <Collapse
            ghost
            size="small"
            activeKey={showDetails ? ['details'] : []}
            onChange={(keys) => setShowDetails(keys.includes('details'))}
            style={{ background: 'rgba(82, 196, 26, 0.04)' }}
            items={[{
              key: 'details',
              label: (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {showDetails ? '收起检索详情' : '查看检索详情'}
                </Text>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                  {retrievalChunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      style={{
                        padding: '8px 12px',
                        background: '#fff',
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#506070' }}>
                          📄 {chunk.documentName}
                        </Text>
                        <Tag
                          color="green"
                          style={{ marginLeft: 'auto', borderRadius: 10, fontSize: 11 }}
                        >
                          {Math.round(chunk.score * 100)}% 相关
                        </Tag>
                      </div>
                      <Text style={{ fontSize: 13, lineHeight: 1.6 }}>
                        {chunk.content.length > 200
                          ? chunk.content.slice(0, 200) + '...'
                          : chunk.content}
                      </Text>
                    </div>
                  ))}
                </div>
              ),
            }]}
          />
        )}
      </div>
    );
  }

  return (
    <Alert
      type="success"
      icon={<CheckCircleOutlined />}
      message={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOutlined />
          <span>已绑定知识库「{knowledge.knowledgeName}」</span>
        </span>
      }
      closable
      onClose={onClose}
      style={{
        marginBottom: 0,
        borderRadius: 0,
        borderLeft: 0,
        borderRight: 0,
        animation: 'fadeIn 0.3s ease',
      }}
    />
  );
}
