import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Modal, List, Avatar, Empty, Spin, Tag } from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  MessageOutlined,
  BookOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { globalSearch, type SearchItem, type SearchItemType } from '../../../api/search';

interface SearchResult {
  id: string;
  type: SearchItemType;
  title: string;
  description?: string;
  icon: React.ReactNode;
  path: string;
}

const TYPE_LABELS: Record<SearchItemType, { label: string; color: string }> = {
  agent: { label: '智能体', color: 'blue' },
  conversation: { label: '对话', color: 'green' },
  knowledge: { label: '知识库', color: 'orange' },
  workflow: { label: '工作流', color: 'purple' },
};

const TYPE_ICONS: Record<SearchItemType, React.ReactNode> = {
  agent: <RobotOutlined style={{ color: '#565fe2' }} />,
  workflow: <DeploymentUnitOutlined style={{ color: '#722ed1' }} />,
  knowledge: <BookOutlined style={{ color: '#fa8c16' }} />,
  conversation: <MessageOutlined style={{ color: '#52c41a' }} />,
};

function toSearchPath(item: SearchItem): string {
  switch (item.type) {
    case 'agent':
      return `/agents/${item.id}`;
    case 'workflow':
      return `/workflows/${item.id}`;
    case 'knowledge':
      return `/knowledge/${item.id}`;
    case 'conversation':
      return '/workspace/chat';
  }
}

function flattenResults(group: Awaited<ReturnType<typeof globalSearch>>): SearchResult[] {
  const items: SearchItem[] = [
    ...group.agents,
    ...group.workflows,
    ...group.knowledgeBases,
    ...group.conversations,
  ];

  return items.map((item) => ({
    id: `${item.type}-${item.id}`,
    type: item.type,
    title: item.title,
    description: item.description ?? undefined,
    icon: TYPE_ICONS[item.type],
    path: toSearchPath(item),
  }));
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = useCallback(async (value: string) => {
    const kw = value.trim();
    if (!kw) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // 聚合搜索智能体、工作流、知识库、对话（后端全局搜索接口）
      const group = await globalSearch(kw);
      setResults(flattenResults(group));
    } catch (err) {
      console.error('搜索失败:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      setOpen(false);
      setKeyword('');
      navigate(item.path);
    },
    [navigate],
  );

  return (
    <>
      <Input
        prefix={<SearchOutlined style={{ color: '#8896a6' }} />}
        placeholder="搜索智能体、对话、知识库..."
        style={{ width: 280, borderRadius: 8, cursor: 'pointer' }}
        readOnly
        onClick={() => setOpen(true)}
        suffix={
          <kbd
            style={{
              fontSize: 11,
              padding: '2px 6px',
              background: '#f0f2f5',
              borderRadius: 4,
              color: '#8896a6',
              border: '1px solid #e8e8e8',
            }}
          >
            ⌘K
          </kbd>
        }
      />

      <Modal
        open={open}
        onCancel={() => {
          setOpen(false);
          setKeyword('');
          setResults([]);
        }}
        footer={null}
        closable={false}
        width={520}
        styles={{ body: { padding: 0, maxHeight: 420, overflow: 'auto' } }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="输入关键词搜索..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => handleSearch(keyword)}
          size="large"
          style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid #f0f0f0' }}
          autoFocus
        />

        <div style={{ padding: '8px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Spin />
            </div>
          ) : results.length === 0 && keyword.trim() ? (
            <Empty description="未找到相关内容" style={{ padding: 32 }} />
          ) : results.length > 0 ? (
            <List
              dataSource={results}
              renderItem={(item) => {
                const typeInfo = TYPE_LABELS[item.type];
                return (
                  <List.Item
                    style={{ padding: '10px 20px', cursor: 'pointer' }}
                    onClick={() => handleSelect(item)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size={36}
                          icon={item.icon}
                          style={{ background: '#f0f2f5' }}
                        />
                      }
                      title={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {item.title}
                          <Tag color={typeInfo.color} style={{ margin: 0, fontSize: 11 }}>
                            {typeInfo.label}
                          </Tag>
                        </span>
                      }
                      description={item.description}
                    />
                  </List.Item>
                );
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#8896a6', fontSize: 13 }}>
              输入关键词开始搜索
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
