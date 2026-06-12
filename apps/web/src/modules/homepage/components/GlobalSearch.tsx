import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Modal, List, Avatar, Empty, Spin, Tag } from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  MessageOutlined,
  BookOutlined,
  DeploymentUnitOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { getAgentList } from '../../../api/agent-config';
import { getWorkflowListRemote } from '../../../api/workflows';
import { getCurrentWorkspaceId } from '../../../api/workspace';

interface SearchResult {
  id: string;
  type: 'agent' | 'conversation' | 'knowledge' | 'workflow';
  title: string;
  description?: string;
  icon: React.ReactNode;
  path: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  agent: { label: '智能体', color: 'blue' },
  conversation: { label: '对话', color: 'green' },
  knowledge: { label: '知识库', color: 'orange' },
  workflow: { label: '工作流', color: 'purple' },
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback(async (value: string) => {
    const kw = value.trim().toLowerCase();
    if (!kw) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // 并行搜索智能体和工作流
      // 注意：对话和知识库搜索暂未实现，需要后端新接口支持
      const workspaceId = await getCurrentWorkspaceId();
      const [agentsResult, wfResult] = await Promise.allSettled([
        getAgentList(),
        getWorkflowListRemote(workspaceId),
      ]);

      const agentResults: SearchResult[] =
        agentsResult.status === 'fulfilled'
          ? agentsResult.value
              .filter((a) => a.name.toLowerCase().includes(kw) || (a.description?.toLowerCase().includes(kw) ?? false))
              .map((a) => ({
                id: `agent-${a.id}`,
                type: 'agent' as const,
                title: a.name,
                description: a.description || a.persona?.slice(0, 50),
                icon: <RobotOutlined style={{ color: '#565fe2' }} />,
                path: `/agents/${a.id}`,
              }))
          : [];

      const wfResults: SearchResult[] =
        wfResult.status === 'fulfilled'
          ? wfResult.value
              .filter((wf) => wf.name.toLowerCase().includes(kw))
              .map((wf) => ({
                id: `wf-${wf.id}`,
                type: 'workflow' as const,
                title: wf.name,
                description: wf.description ?? undefined,
                icon: <DeploymentUnitOutlined style={{ color: '#a855f7' }} />,
                path: `/workflows/${wf.id}`,
              }))
          : [];

      // 合并结果，智能体优先
      setResults([...agentResults, ...wfResults]);
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
        placeholder="搜索智能体、工作流..."
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
          onChange={(e) => {
            const val = e.target.value;
            setKeyword(val);
            // 300ms 防抖自动搜索
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => handleSearch(val), 300);
          }}
          onPressEnter={() => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            handleSearch(keyword);
          }}
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
