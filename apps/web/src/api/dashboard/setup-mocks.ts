import { registerMockHandler } from '../http';

let registered = false;

const mockDashboardData = {
  agentCount: 3,
  conversationCount: 5,
  workflowCount: 1,
  pluginCount: 0,
  knowledgeBaseCount: 0,
  recentAgents: [
    {
      id: 'agent-1',
      name: '客服Bot',
      avatarUrl: null,
      status: 'published',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'agent-2',
      name: '翻译助手',
      avatarUrl: null,
      status: 'draft',
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'agent-3',
      name: '数据分析',
      avatarUrl: null,
      status: 'published',
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
  recentConversations: [
    {
      id: 'conv-1',
      title: '产品咨询对话',
      updatedAt: new Date().toISOString(),
      agent: { id: 'agent-1', name: '客服Bot' },
    },
    {
      id: 'conv-2',
      title: '代码审查对话',
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      agent: { id: 'agent-3', name: '数据分析' },
    },
    {
      id: 'conv-3',
      title: '文档翻译对话',
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      agent: { id: 'agent-2', name: '翻译助手' },
    },
  ],
};

export function setupDashboardMocks() {
  if (registered) return;
  registered = true;

  // 精确匹配 /api/workspaces/:workspaceId/dashboard
  registerMockHandler('GET', 'workspaces/default-workspace/dashboard', async () => {
    return {
      code: 0,
      message: 'ok',
      data: { ...mockDashboardData },
    };
  });
}
