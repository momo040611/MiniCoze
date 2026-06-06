import { registerMockHandler } from '../http';

let registered = false;

// 生成相对时间的辅助函数
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}
function minsAgo(m: number): string {
  return new Date(Date.now() - m * 60000).toISOString();
}

const mockDashboardData = {
  agentCount: 5,
  conversationCount: 12,
  workflowCount: 3,
  pluginCount: 4,
  knowledgeBaseCount: 2,
  publishPendingCount: 2,
  pluginEnabledCount: 3,
  pluginUpdateCount: 1,
  recentAgents: [
    {
      id: 'agent-001',
      name: 'AI 助手',
      description: '通用 AI 对话助手，支持多种任务',
      avatarUrl: null,
      status: 'published',
      updatedAt: minsAgo(5),
    },
    {
      id: 'agent-002',
      name: '代码审查助手',
      description: '专注于代码质量审查和建议',
      avatarUrl: null,
      status: 'published',
      updatedAt: minsAgo(30),
    },
    {
      id: 'agent-003',
      name: '客服 Bot',
      description: '智能客服，处理用户咨询',
      avatarUrl: null,
      status: 'draft',
      updatedAt: hoursAgo(2),
    },
    {
      id: 'agent-004',
      name: '翻译助手',
      description: '多语言翻译服务',
      avatarUrl: null,
      status: 'published',
      updatedAt: hoursAgo(5),
    },
    {
      id: 'agent-005',
      name: '数据分析 Agent',
      description: '数据可视化与分析',
      avatarUrl: null,
      status: 'draft',
      updatedAt: hoursAgo(24),
    },
  ],
  recentConversations: [
    {
      id: 'conv-1',
      title: '产品咨询对话',
      updatedAt: minsAgo(2),
      agent: { id: 'agent-001', name: 'AI 助手' },
    },
    {
      id: 'conv-2',
      title: '代码审查对话',
      updatedAt: minsAgo(15),
      agent: { id: 'agent-002', name: '代码审查助手' },
    },
    {
      id: 'conv-3',
      title: '文档翻译对话',
      updatedAt: hoursAgo(1),
      agent: { id: 'agent-004', name: '翻译助手' },
    },
  ],
  recentWorkflows: [
    {
      id: 'run-1',
      workflowId: 'wf-001',
      workflowName: '客户反馈处理流程',
      status: 'success' as const,
      startedAt: minsAgo(10),
      duration: 45000,
    },
    {
      id: 'run-2',
      workflowId: 'wf-002',
      workflowName: '数据清洗 Pipeline',
      status: 'running' as const,
      startedAt: minsAgo(3),
    },
    {
      id: 'run-3',
      workflowId: 'wf-003',
      workflowName: '文档自动摘要',
      status: 'failed' as const,
      startedAt: hoursAgo(1),
      duration: 12000,
    },
  ],
  recentLogs: [
    {
      id: 'log-1',
      type: 'tool_call' as const,
      agentName: 'AI 助手',
      content: '调用 web_search 搜索 "React 18 新特性"',
      timestamp: minsAgo(1),
      status: 'success' as const,
    },
    {
      id: 'log-2',
      type: 'knowledge_retrieval' as const,
      agentName: '代码审查助手',
      content: '从 "代码规范文档" 召回 3 条相关片段，最高相似度 92%',
      timestamp: minsAgo(5),
      status: 'success' as const,
    },
    {
      id: 'log-3',
      type: 'tool_call' as const,
      agentName: 'AI 助手',
      content: '调用 database_query 查询用户数据',
      timestamp: minsAgo(8),
      status: 'failed' as const,
    },
    {
      id: 'log-4',
      type: 'workflow_step' as const,
      agentName: '客服 Bot',
      content: '工作流 "客户反馈处理流程" 执行节点：分类判断 → 情绪分析 → 生成回复',
      timestamp: minsAgo(12),
      status: 'success' as const,
    },
    {
      id: 'log-5',
      type: 'knowledge_retrieval' as const,
      agentName: '翻译助手',
      content: '从 "术语表" 召回 1 条相关片段，相似度 87%',
      timestamp: minsAgo(20),
      status: 'success' as const,
    },
  ],
};

export function setupDashboardMocks() {
  if (registered) return;
  registered = true;

  // 精确匹配 dashboard 接口
  registerMockHandler('GET', 'workspaces/default-workspace/dashboard', async () => {
    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    return {
      code: 0,
      message: 'ok',
      data: { ...mockDashboardData },
    };
  });
}
