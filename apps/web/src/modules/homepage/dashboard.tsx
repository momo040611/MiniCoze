// 工作台 Dashboard — 资源概览、最近智能体/工作流、插件状态、发布状态、运行日志
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton, Result, Tag, Avatar } from 'antd';
import {
  RobotOutlined, MessageOutlined, BookOutlined,
  DeploymentUnitOutlined, ApiOutlined, UserOutlined, HomeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import styles from './dashboard.module.css';
import {
  getDashboardSummary,
  type DashboardSummary,
  type DashboardAgentSummary,
  type DashboardConversationSummary,
} from '../../api/dashboard';
import { getCurrentUser } from '../../api/auth/auth-store';
import { useWorkspace } from '../workspace/use-workspace';
import {
  RecentWorkflowsSection,
  PluginStatusSection,
  PublishStatusSection,
  RunLogSection,
} from './components/dashboard';

// ══════════════════════════════════════════════
// 统计数据卡片配置
// ══════════════════════════════════════════════

interface StatDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  accentClass: string;
  count: number;
  goTo: string;
}

function buildStats(d: DashboardSummary): StatDef[] {
  return [
    { key: 'agents', label: '智能体', icon: <RobotOutlined />, accentClass: 'agents', count: d.agentCount, goTo: '/agents' },
    { key: 'knowledge', label: '知识库', icon: <BookOutlined />, accentClass: 'knowledge', count: d.knowledgeBaseCount, goTo: '/knowledge' },
    { key: 'workflows', label: '工作流', icon: <DeploymentUnitOutlined />, accentClass: 'workflows', count: d.workflowCount, goTo: '/workflows' },
    { key: 'plugins', label: '插件', icon: <ApiOutlined />, accentClass: 'plugins', count: d.pluginCount, goTo: '/plugins' },
    { key: 'publish', label: '待发布', icon: <ThunderboltOutlined />, accentClass: 'conversations', count: d.publishPendingCount, goTo: '/publish' },
  ];
}

// ══════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════

function fmtTime(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(d).toLocaleDateString('zh-CN');
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function getDateStr(): string {
  return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'green' },
  draft: { label: '草稿', color: 'default' },
  archived: { label: '已归档', color: '#8896a6' },
};

// ══════════════════════════════════════════════
// 加载态
// ══════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.skeletonHero}>
        <Skeleton active paragraph={false} title={{ width: 200 }} />
        <Skeleton active paragraph={false} title={{ width: 280 }} />
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeletonCard}>
            <Skeleton.Avatar active size={44} shape="square" style={{ borderRadius: 12 }} />
            <Skeleton active paragraph={{ rows: 1 }} title={false} />
          </div>
        ))}
      </div>
      <div className={styles.skeletonActions}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeletonActionCard}>
            <Skeleton.Avatar active size={48} shape="square" style={{ borderRadius: 14 }} />
            <Skeleton active paragraph={{ rows: 2 }} title={{ width: 80 }} />
          </div>
        ))}
      </div>
      <div className={styles.skeletonPanels}>
        <div className={styles.skeletonPanel}>
          <Skeleton active paragraph={{ rows: 3 }} title={{ width: 100 }} />
        </div>
        <div className={styles.skeletonPanel}>
          <Skeleton active paragraph={{ rows: 3 }} title={{ width: 100 }} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 错误态（全页）
// ══════════════════════════════════════════════

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.errorState}>
      <Result
        status="error"
        title="数据加载失败"
        subTitle="获取工作台数据失败，请检查网络连接"
        extra={
          <button className={styles.emptyPrimaryBtn} onClick={onRetry}>
            <ThunderboltOutlined /> 重新加载
          </button>
        }
      />
    </div>
  );
}

// ══════════════════════════════════════════════
// Hero Banner
// ══════════════════════════════════════════════

function HeroBanner({ name, workspace }: { name: string; workspace: string }) {
  return (
    <div className={styles.heroBanner}>
      <div className={styles.heroLeft}>
        <h1 className={styles.heroGreeting}>
          {getGreeting()}，{name}
        </h1>
        <p className={styles.heroSub}>{getDateStr()}</p>
      </div>
      <div className={styles.heroRight}>
        <div className={styles.heroWorkspace}>
          <HomeOutlined className={styles.heroWorkspaceIcon} />
          {workspace}
        </div>
        <span className={styles.heroDate}>MiniCoze AI Agent 平台</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 统计卡片区
// ══════════════════════════════════════════════

function StatsRow({ stats, onGo }: { stats: StatDef[]; onGo: (path: string) => void }) {
  return (
    <div className={styles.statsGrid}>
      {stats.map((s) => (
        <button
          key={s.key}
          className={`${styles.statCard} ${styles[s.accentClass]}`}
          onClick={() => onGo(s.goTo)}
          aria-label={`${s.label}: ${s.count}个，${s.count > 0 ? '查看详情' : '点击创建'}`}
        >
          <div className={`${styles.statIconGradient} ${styles[s.accentClass]}`}>{s.icon}</div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>{s.label}</span>
            <span className={styles.statValue}>{s.count}</span>
          </div>
          <span className={styles.statHint} aria-hidden="true">
            {s.count > 0 ? '查看详情 →' : '点击创建 →'}
          </span>
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// 快捷操作区
// ══════════════════════════════════════════════

function QuickCreate({ onGo }: { onGo: (path: string) => void }) {
  return (
    <>
      <div className={styles.sectionDivider}>
        <span className={styles.sectionLabel}>快捷创建</span>
        <div className={styles.sectionLine} />
      </div>
      <div className={styles.quickActions}>
        <button className={styles.quickActionCard} onClick={() => onGo('/agents')} aria-label="创建智能体">
          <div className={styles.quickActionIcon}><RobotOutlined /></div>
          <span className={styles.quickActionTitle}>创建智能体</span>
          <span className={styles.quickActionDesc}>配置角色、模型与技能</span>
        </button>
        <button className={styles.quickActionCard} onClick={() => onGo('/knowledge')} aria-label="创建知识库">
          <div className={styles.quickActionIcon}><BookOutlined /></div>
          <span className={styles.quickActionTitle}>创建知识库</span>
          <span className={styles.quickActionDesc}>上传文档、解析与检索</span>
        </button>
        <button className={styles.quickActionCard} onClick={() => onGo('/workflows')} aria-label="创建工作流">
          <div className={styles.quickActionIcon}><DeploymentUnitOutlined /></div>
          <span className={styles.quickActionTitle}>创建工作流</span>
          <span className={styles.quickActionDesc}>编排节点与流程逻辑</span>
        </button>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════
// 最近智能体面板
// ══════════════════════════════════════════════

function AgentsPanel({ items, onGo }: { items: DashboardAgentSummary[]; onGo: (path: string) => void }) {
  return (
    <div className={styles.sectionPanel}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderLeft}>
          <span className={`${styles.sectionDot} ${styles.agents}`} />
          <span className={styles.sectionTitle}>最近使用的智能体</span>
          {items.length > 0 && <span className={styles.sectionBadge}>{items.length}</span>}
        </div>
        <button className={styles.sectionMore} onClick={() => onGo('/agents')} aria-label="查看全部智能体">
          查看全部 →
        </button>
      </div>
      <div className={styles.sectionList}>
        {items.length === 0 ? (
          <div className={styles.sectionEmpty}>
            <p style={{ margin: '0 0 12px' }}>暂无智能体</p>
            <button onClick={() => onGo('/agents')} className={styles.emptyPrimaryBtn} style={{ fontSize: 13, padding: '6px 16px' }}>
              + 创建第一个智能体
            </button>
          </div>
        ) : (
          items.map((a) => {
            const statusCfg = STATUS_MAP[a.status] ?? { label: a.status, color: 'default' };
            return (
              <button
                key={a.id}
                className={styles.recentItem}
                onClick={() => onGo(`/agents/${a.id}`)}
                aria-label={`智能体: ${a.name}，状态: ${statusCfg.label}`}
              >
                <Avatar
                  className={styles.recentItemAvatar}
                  size={36}
                  src={a.avatarUrl ?? undefined}
                  icon={!a.avatarUrl ? <UserOutlined /> : undefined}
                  style={{ borderRadius: 10, flexShrink: 0 }}
                />
                <div className={styles.recentItemInfo}>
                  <div className={styles.recentItemName}>{a.name}</div>
                  <div className={styles.recentItemMeta}>
                    {a.description && <span style={{ marginRight: 4 }}>{a.description}</span>}
                    <Tag color={statusCfg.color} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>{statusCfg.label}</Tag>
                  </div>
                </div>
                <span className={styles.recentItemTime}>{fmtTime(a.updatedAt)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 最近对话面板
// ══════════════════════════════════════════════

function ConversationsPanel({ items, onGo }: { items: DashboardConversationSummary[]; onGo: (path: string) => void }) {
  return (
    <div className={styles.sectionPanel}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderLeft}>
          <span className={`${styles.sectionDot} ${styles.conversations}`} />
          <span className={styles.sectionTitle}>最近对话</span>
          {items.length > 0 && <span className={styles.sectionBadge}>{items.length}</span>}
        </div>
        <button className={styles.sectionMore} onClick={() => onGo('/workspace/chat')} aria-label="查看全部对话">
          查看全部 →
        </button>
      </div>
      <div className={styles.sectionList}>
        {items.length === 0 ? (
          <div className={styles.sectionEmpty}>
            <p style={{ margin: '0 0 12px' }}>暂无对话记录</p>
            <button onClick={() => onGo('/workspace/chat')} className={styles.emptyPrimaryBtn} style={{ fontSize: 13, padding: '6px 16px' }}>
              开始新对话
            </button>
          </div>
        ) : (
          items.map((c) => (
            <button
              key={c.id}
              className={styles.recentItem}
              onClick={() => onGo(`/workspace/chat?agentId=${c.agent.id}&conversationId=${c.id}`)}
              aria-label={`对话: ${c.title || '未命名对话'}，智能体: ${c.agent?.name ?? '未知智能体'}`}
            >
              <div className={styles.recentItemIconConv}><MessageOutlined /></div>
              <div className={styles.recentItemInfo}>
                <div className={styles.recentItemName}>{c.title || '未命名对话'}</div>
                <div className={styles.recentItemMeta}>{c.agent?.name ?? '未知智能体'}</div>
              </div>
              <span className={styles.recentItemTime}>{fmtTime(c.updatedAt)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════

export function DashboardPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const user = getCurrentUser();
  const { currentWorkspace } = useWorkspace();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await getDashboardSummary();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const go = useCallback((p: string) => nav(p), [nav]);
  const stats = useMemo(() => data ? buildStats(data) : [], [data]);

  // 全页加载态
  if (loading && !data) return <LoadingSkeleton />;

  // 全页错误态（首次加载失败）
  if (error && !data) return <ErrorState onRetry={fetchData} />;

  return (
    <div className={styles.page}>
      <HeroBanner
        name={user?.username ?? '用户'}
        workspace={currentWorkspace?.name ?? '我的工作空间'}
      />
      <StatsRow stats={stats} onGo={go} />
      <QuickCreate onGo={go} />

      {/* 发布状态提示条 */}
      {data && (
        <PublishStatusSection
          publishPendingCount={data.publishPendingCount}
          onGo={go}
        />
      )}

      {/* 双栏：最近智能体 + 最近对话 */}
      <div className={styles.contentPanels}>
        <AgentsPanel items={data?.recentAgents ?? []} onGo={go} />
        <ConversationsPanel items={data?.recentConversations ?? []} onGo={go} />
      </div>

      {/* 双栏：工作流运行 + 插件状态 */}
      <div className={styles.contentPanels}>
        <RecentWorkflowsSection
          state={loading ? 'loading' : data?.recentWorkflows?.length ? 'data' : 'empty'}
          items={data?.recentWorkflows ?? []}
          onGo={go}
          onRetry={fetchData}
        />
        <PluginStatusSection
          state={loading ? 'loading' : data ? 'data' : 'error'}
          totalCount={data?.pluginCount ?? 0}
          enabledCount={data?.pluginEnabledCount ?? 0}
          updateCount={data?.pluginUpdateCount ?? 0}
          onGo={go}
          onRetry={fetchData}
        />
      </div>

      {/* 统一运行日志 */}
      <RunLogSection
        state={loading ? 'loading' : data?.recentLogs?.length ? 'data' : 'empty'}
        logs={data?.recentLogs ?? []}
      />
    </div>
  );
}
