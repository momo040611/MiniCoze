import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton, Result, Tag, Avatar } from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  MessageOutlined,
  BookOutlined,
  DeploymentUnitOutlined,
  ApiOutlined,
  UserOutlined,
  HomeOutlined,
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

type PageState = 'loading' | 'data' | 'empty' | 'error';

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
    { key: 'conversations', label: '对话', icon: <MessageOutlined />, accentClass: 'conversations', count: d.conversationCount, goTo: '/workspace/chat' },
    { key: 'knowledge', label: '知识库', icon: <BookOutlined />, accentClass: 'knowledge', count: d.knowledgeBaseCount, goTo: '/knowledge-bases' },
    { key: 'workflows', label: '工作流', icon: <DeploymentUnitOutlined />, accentClass: 'workflows', count: d.workflowCount, goTo: '/workflows' },
    { key: 'plugins', label: '插件', icon: <ApiOutlined />, accentClass: 'plugins', count: d.pluginCount, goTo: '/plugins' },
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
// 错误态
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
// 空数据态
// ══════════════════════════════════════════════

function EmptyState() {
  const nav = useNavigate();
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIllustration}>
        <RobotOutlined style={{ fontSize: 56, opacity: 0.6 }} />
      </div>
      <h2 className={styles.emptyTitle}>开始搭建你的第一个 AI 智能体</h2>
      <p className={styles.emptyDesc}>
        创建智能体、配置知识库、编排工作流，一切从这里开始
      </p>
      <div className={styles.emptyActions}>
        <button className={styles.emptyPrimaryBtn} onClick={() => nav('/agents')}>
          <PlusOutlined /> 创建智能体
        </button>
        <button className={styles.emptySecondaryBtn} onClick={() => nav('/knowledge-bases')}>
          <BookOutlined /> 创建知识库
        </button>
        <button className={styles.emptySecondaryBtn} onClick={() => nav('/workflows')}>
          <DeploymentUnitOutlined /> 创建工作流
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 数据态 — Hero Banner
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
// 数据态 — 统计卡片区
// ══════════════════════════════════════════════

function StatsRow({ stats, onGo }: { stats: StatDef[]; onGo: (path: string) => void }) {
  return (
    <div className={styles.statsGrid}>
      {stats.map((s) => (
        <div
          key={s.key}
          className={`${styles.statCard} ${styles[s.accentClass]}`}
          onClick={() => onGo(s.goTo)}
        >
          <div className={`${styles.statIconGradient} ${styles[s.accentClass]}`}>{s.icon}</div>
          <div className={styles.statBody}>
            <span className={styles.statLabel}>{s.label}</span>
            <span className={styles.statValue}>{s.count}</span>
          </div>
          <span className={styles.statHint}>
            {s.count > 0 ? '查看详情 →' : '点击创建 →'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// 数据态 — 快捷操作区
// ══════════════════════════════════════════════

function QuickCreate({ onGo }: { onGo: (path: string) => void }) {
  return (
    <>
      <div className={styles.sectionDivider}>
        <span className={styles.sectionLabel}>快捷创建</span>
        <div className={styles.sectionLine} />
      </div>
      <div className={styles.quickActions}>
        <div className={styles.quickActionCard} onClick={() => onGo('/agents')}>
          <div className={styles.quickActionIcon}><RobotOutlined /></div>
          <span className={styles.quickActionTitle}>创建智能体</span>
          <span className={styles.quickActionDesc}>配置角色、模型与技能</span>
        </div>
        <div className={styles.quickActionCard} onClick={() => onGo('/knowledge-bases')}>
          <div className={styles.quickActionIcon}><BookOutlined /></div>
          <span className={styles.quickActionTitle}>创建知识库</span>
          <span className={styles.quickActionDesc}>上传文档、解析与检索</span>
        </div>
        <div className={styles.quickActionCard} onClick={() => onGo('/workflows')}>
          <div className={styles.quickActionIcon}><DeploymentUnitOutlined /></div>
          <span className={styles.quickActionTitle}>创建工作流</span>
          <span className={styles.quickActionDesc}>编排节点与流程逻辑</span>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════
// 数据态 — 最近对话面板
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
        <span className={styles.sectionMore} onClick={() => onGo('/workspace/chat')}>查看全部 →</span>
      </div>
      <div className={styles.sectionList}>
        {items.length === 0 ? (
          <div className={styles.sectionEmpty}>暂无对话记录</div>
        ) : (
          items.map((c) => (
            <div key={c.id} className={styles.recentItem} onClick={() => onGo(`/workspace/chat?conversationId=${c.id}`)}>
              <div className={styles.recentItemIconConv}><MessageOutlined /></div>
              <div className={styles.recentItemInfo}>
                <div className={styles.recentItemName}>{c.title || '未命名对话'}</div>
                <div className={styles.recentItemMeta}>{c.agent?.name ?? '未知智能体'}</div>
              </div>
              <span className={styles.recentItemTime}>{fmtTime(c.updatedAt)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 数据态 — 最近智能体面板
// ══════════════════════════════════════════════

function AgentsPanel({ items, onGo }: { items: DashboardAgentSummary[]; onGo: (path: string) => void }) {
  return (
    <div className={styles.sectionPanel}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderLeft}>
          <span className={`${styles.sectionDot} ${styles.agents}`} />
          <span className={styles.sectionTitle}>最近智能体</span>
          {items.length > 0 && <span className={styles.sectionBadge}>{items.length}</span>}
        </div>
        <span className={styles.sectionMore} onClick={() => onGo('/agents')}>查看全部 →</span>
      </div>
      <div className={styles.sectionList}>
        {items.length === 0 ? (
          <div className={styles.sectionEmpty}>暂无智能体</div>
        ) : (
          items.map((a) => {
            const statusCfg = STATUS_MAP[a.status] ?? { label: a.status, color: 'default' };
            return (
              <div key={a.id} className={styles.recentItem} onClick={() => onGo(`/agents?id=${a.id}`)}>
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
                    <Tag color={statusCfg.color} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>{statusCfg.label}</Tag>
                  </div>
                </div>
                <span className={styles.recentItemTime}>{fmtTime(a.updatedAt)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 数据态 — 主视图
// ══════════════════════════════════════════════

function DataView({ data, onGo }: { data: DashboardSummary; onGo: (path: string) => void }) {
  const user = getCurrentUser();
  const { currentWorkspace } = useWorkspace();
  const stats = useMemo(() => buildStats(data), [data]);

  return (
    <div className={styles.page}>
      <HeroBanner
        name={user?.username ?? '用户'}
        workspace={currentWorkspace?.name ?? '我的工作空间'}
      />
      <StatsRow stats={stats} onGo={onGo} />
      <QuickCreate onGo={onGo} />
      <div className={styles.contentPanels}>
        <ConversationsPanel items={data.recentConversations} onGo={onGo} />
        <AgentsPanel items={data.recentAgents} onGo={onGo} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════

export function DashboardPage() {
  const nav = useNavigate();
  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [errMsg, setErrMsg] = useState('');

  const fetch = useCallback(async () => {
    setState('loading');
    setErrMsg('');
    try {
      const d = await getDashboardSummary();
      const empty =
        d.agentCount === 0 && d.conversationCount === 0 &&
        d.workflowCount === 0 && d.pluginCount === 0 &&
        d.knowledgeBaseCount === 0 &&
        d.recentAgents.length === 0 && d.recentConversations.length === 0;
      setData(d);
      setState(empty ? 'empty' : 'data');
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : '未知错误');
      setState('error');
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const go = useCallback((p: string) => nav(p), [nav]);

  switch (state) {
    case 'loading': return <LoadingSkeleton />;
    case 'error': return <ErrorState onRetry={fetch} />;
    case 'empty': return <EmptyState />;
    case 'data': return <DataView data={data!} onGo={go} />;
    default: return null;
  }
}
