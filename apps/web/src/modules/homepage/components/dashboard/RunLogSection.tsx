// 统一运行日志区块 — 展示所有智能体运行事件流
import { useState, useRef, useEffect, useCallback } from 'react';
import { Tag } from 'antd';
import {
  ToolOutlined, BookOutlined, DeploymentUnitOutlined,
  CheckCircleFilled, CloseCircleFilled, PauseCircleOutlined,
  PlayCircleOutlined, DeleteOutlined,
} from '@ant-design/icons';
import type { DashboardRunLog } from '../../../../api/dashboard';

const TYPE_CFG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  tool_call: { label: '工具调用', icon: <ToolOutlined />, color: '#3b82f6' },
  knowledge_retrieval: { label: '知识库召回', icon: <BookOutlined />, color: '#a855f7' },
  workflow_step: { label: '工作流步骤', icon: <DeploymentUnitOutlined />, color: '#f59e0b' },
};

function fmtTime(d: string): string {
  return new Date(d).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface Props {
  logs: DashboardRunLog[];
  state: 'loading' | 'data' | 'empty' | 'error';
}

export function RunLogSection({ logs, state }: Props) {
  const [paused, setPaused] = useState(false);
  const [cleared, setCleared] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const visibleLogs = cleared ? [] : logs;

  // 自动滚动到底部
  useEffect(() => {
    if (autoScrollRef.current && !paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLogs, paused]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const handleClear = () => setCleared(true);
  const handleRestore = () => setCleared(false);

  return (
    <div style={{
      background: '#ffffff', border: '1px solid rgba(104, 119, 144, 0.08)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 22px', borderBottom: '1px solid rgba(104, 119, 144, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#3b82f6',
            boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
          }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#18202f' }}>
            AgentRun 统一运行日志
          </span>
          {!cleared && (
            <span style={{
              padding: '2px 8px', borderRadius: 6,
              background: 'rgba(104, 119, 144, 0.08)',
              fontSize: 12, fontWeight: 500, color: '#6b7280',
            }}>{visibleLogs.length}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setPaused(!paused)}
            title={paused ? '继续滚动' : '暂停滚动'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6, fontSize: 12,
              background: paused ? 'rgba(245, 158, 11, 0.08)' : 'rgba(104, 119, 144, 0.06)',
              color: paused ? '#d97706' : '#6b7280',
              border: 'none', cursor: 'pointer', font: 'inherit',
            }}
          >
            {paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            {paused ? '继续' : '暂停'}
          </button>
          {cleared ? (
            <button
              onClick={handleRestore}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                background: 'rgba(34, 197, 94, 0.06)', color: '#22c55e',
                border: 'none', cursor: 'pointer', font: 'inherit',
              }}
            >恢复日志</button>
          ) : (
            <button
              onClick={handleClear}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                background: 'rgba(104, 119, 144, 0.06)', color: '#6b7280',
                border: 'none', cursor: 'pointer', font: 'inherit',
              }}
            ><DeleteOutlined /> 清空</button>
          )}
        </div>
      </div>

      {/* 日志列表 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          maxHeight: 280, overflowY: 'auto', padding: '8px 0',
        }}
      >
        {state === 'loading' && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            加载中...
          </div>
        )}
        {cleared && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            日志已清空，点击"恢复日志"查看
          </div>
        )}
        {!cleared && visibleLogs.length === 0 && state === 'data' && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            暂无运行日志
          </div>
        )}
        {!cleared && visibleLogs.map((log) => {
          const typeCfg = TYPE_CFG[log.type] || TYPE_CFG.tool_call;
          return (
            <div
              key={log.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 22px', transition: 'background 0.15s',
                borderLeft: `3px solid ${typeCfg.color}20`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${typeCfg.color}06`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ fontSize: 14, color: typeCfg.color, marginTop: 2, flexShrink: 0 }}>
                {typeCfg.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Tag color={typeCfg.color} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                    {typeCfg.label}
                  </Tag>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{log.agentName}</span>
                  {log.status && (
                    <span style={{ fontSize: 12, color: log.status === 'success' ? '#22c55e' : '#ef4444' }}>
                      {log.status === 'success' ? <CheckCircleFilled /> : <CloseCircleFilled />}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 13, color: '#506070', marginTop: 3, lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {log.content}
                </div>
              </div>
              <span style={{
                fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2,
              }}>
                {fmtTime(log.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
