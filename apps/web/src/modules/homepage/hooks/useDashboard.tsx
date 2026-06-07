import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDashboardSummary,
  type DashboardSummary,
  type ActivityItem,
  type StatItem,
  type SystemStatusData,
} from '../../../api/dashboard';
import { getCurrentUser } from '../../../api/auth/auth-store';
import { useWorkspace } from '../../workspace/use-workspace';
import {
  RobotOutlined,
  BookOutlined,
  DeploymentUnitOutlined,
  ApiOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const PAGE_SIZE = 10;

const STAT_DEFS: Omit<StatItem, 'value'>[] = [
  { key: 'agents', label: '智能体', icon: <RobotOutlined />, accentColor: '#22c55e', targetPath: '/agents' },
  { key: 'knowledge', label: '知识库', icon: <BookOutlined />, accentColor: '#a855f7', targetPath: '/knowledge' },
  { key: 'workflows', label: '工作流', icon: <DeploymentUnitOutlined />, accentColor: '#f59e0b', targetPath: '/workflows' },
  { key: 'plugins', label: '插件', icon: <ApiOutlined />, accentColor: '#ec4899', targetPath: '/plugins' },
  { key: 'publish', label: '待发布', icon: <ThunderboltOutlined />, accentColor: '#3b82f6', targetPath: '/publish' },
];

function fmtRelativeTime(d: string): string {
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
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: '已发布', color: 'green' },
  draft: { label: '草稿', color: 'default' },
  archived: { label: '已归档', color: '#8896a6' },
};

const WORKFLOW_STATUS_MAP: Record<string, { label: string; color: string }> = {
  running: { label: '运行中', color: '#3b82f6' },
  success: { label: '成功', color: '#22c55e' },
  failed: { label: '失败', color: '#ef4444' },
};

function buildStats(d: DashboardSummary): StatItem[] {
  const countMap: Record<string, number> = {
    agents: d.agentCount ?? 0,
    knowledge: d.knowledgeBaseCount ?? 0,
    workflows: d.workflowCount ?? 0,
    plugins: d.pluginCount ?? 0,
    publish: d.publishPendingCount ?? 0,
  };
  return STAT_DEFS.map((def) => ({ ...def, value: countMap[def.key] ?? 0 }));
}

function buildActivities(d: DashboardSummary): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const a of d.recentAgents ?? []) {
    const st = STATUS_MAP[a.status] ?? { label: a.status, color: '#6b7280' };
    items.push({
      id: `agent-${a.id}`,
      type: 'agent',
      title: a.name,
      subtitle: a.description ?? '',
      status: st.label,
      statusColor: st.color,
      timestamp: a.updatedAt,
      relativeTime: fmtRelativeTime(a.updatedAt),
      targetPath: `/agents/${a.id}`,
    });
  }

  for (const c of d.recentConversations ?? []) {
    items.push({
      id: `conv-${c.id}`,
      type: 'conversation',
      title: c.title || '未命名对话',
      subtitle: c.agent?.name ?? '未知智能体',
      timestamp: c.updatedAt,
      relativeTime: fmtRelativeTime(c.updatedAt),
      targetPath: `/workspace/chat?agentId=${c.agent?.id ?? ''}&conversationId=${c.id}`,
    });
  }

  for (const w of d.recentWorkflows ?? []) {
    const st = WORKFLOW_STATUS_MAP[w.status] ?? { label: w.status, color: '#6b7280' };
    items.push({
      id: `wfrun-${w.id}`,
      type: 'workflow',
      title: w.workflowName,
      subtitle: `状态: ${st.label}`,
      status: st.label,
      statusColor: st.color,
      timestamp: w.startedAt,
      relativeTime: fmtRelativeTime(w.startedAt),
      targetPath: `/workflows/${w.workflowId}`,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items;
}

function buildSystemStatus(d: DashboardSummary): SystemStatusData {
  return {
    plugins: {
      enabled: d.pluginEnabledCount ?? 0,
      total: d.pluginCount ?? 0,
      updateAvailable: d.pluginUpdateCount ?? 0,
    },
    publish: {
      pending: d.publishPendingCount ?? 0,
      published: Math.max(0, (d.agentCount ?? 0) - (d.publishPendingCount ?? 0)),
    },
    knowledge: {
      synced: d.knowledgeBaseCount ?? 0,
      total: d.knowledgeBaseCount ?? 0,
    },
  };
}

export interface UseDashboardReturn {
  data: DashboardSummary | null;
  statsState: 'loading' | 'data' | 'error';
  activityState: 'loading' | 'data' | 'empty' | 'error';
  systemState: 'loading' | 'data' | 'error';
  logsState: 'loading' | 'data' | 'empty' | 'error';
  refresh: () => Promise<void>;
  loadMoreActivities: () => void;
  sidePanelCollapsed: boolean;
  toggleSidePanel: () => void;
  logDrawerOpen: boolean;
  openLogDrawer: () => void;
  closeLogDrawer: () => void;
  stats: StatItem[];
  activities: ActivityItem[];
  hasMoreActivities: boolean;
  systemStatus: SystemStatusData | null;
  userName: string;
  workspaceName: string;
  workspaceDescription: string | null;
  workspaceRole: string | undefined;
  memberCount: number;
  greeting: string;
  dateStr: string;
}

export function useDashboard(): UseDashboardReturn {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const user = getCurrentUser();
  const { currentWorkspace } = useWorkspace();

  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const d = await getDashboardSummary();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [data]);

  const allActivities = useMemo(() => (data ? buildActivities(data) : []), [data]);
  const activities = useMemo(() => allActivities.slice(0, displayCount), [allActivities, displayCount]);
  const hasMoreActivities = displayCount < allActivities.length;

  const stats = useMemo(() => (data ? buildStats(data) : []), [data]);
  const systemStatus = useMemo(() => (data ? buildSystemStatus(data) : null), [data]);

  const statsState: UseDashboardReturn['statsState'] = loading ? 'loading' : error ? 'error' : 'data';
  const activityState: UseDashboardReturn['activityState'] = loading
    ? 'loading'
    : error
      ? 'error'
      : allActivities.length === 0
        ? 'empty'
        : 'data';
  const systemState: UseDashboardReturn['systemState'] = loading ? 'loading' : error ? 'error' : 'data';
  const logsState: UseDashboardReturn['logsState'] = loading
    ? 'loading'
    : error
      ? 'error'
      : (data?.recentLogs?.length ?? 0) === 0
        ? 'empty'
        : 'data';

  const loadMoreActivities = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, allActivities.length));
  }, [allActivities.length]);

  const toggleSidePanel = useCallback(() => {
    setSidePanelCollapsed((prev) => !prev);
  }, []);

  const openLogDrawer = useCallback(() => setLogDrawerOpen(true), []);
  const closeLogDrawer = useCallback(() => setLogDrawerOpen(false), []);

  const userName = user?.username ?? '用户';
  const workspaceName = currentWorkspace?.name ?? '我的工作空间';
  const workspaceDescription = currentWorkspace?.description ?? null;
  const workspaceRole = currentWorkspace?.role;
  const memberCount = data?.memberCount ?? 0;
  const greeting = getGreeting();
  const dateStr = getDateStr();

  return {
    data,
    statsState,
    activityState,
    systemState,
    logsState,
    refresh: fetchData,
    loadMoreActivities,
    sidePanelCollapsed,
    toggleSidePanel,
    logDrawerOpen,
    openLogDrawer,
    closeLogDrawer,
    stats,
    activities,
    hasMoreActivities,
    systemStatus,
    userName,
    workspaceName,
    workspaceDescription,
    workspaceRole,
    memberCount,
    greeting,
    dateStr,
  };
}
