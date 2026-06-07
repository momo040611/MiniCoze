// Dashboard Mock 注册 — 仅在 VITE_USE_AUTH_MOCK=true 时生效
import { registerMockHandler } from '../http';
import { mockDashboardSummary } from './mock-data';

let registered = false;

export function setupDashboardMocks() {
  if (registered) return;
  registered = true;

  // 匹配 GET workspaces/:workspaceId/dashboard
  registerMockHandler('GET', 'workspaces/default-workspace/dashboard', async () => {
    // 模拟网络延迟 (200-500ms)
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    return {
      code: 0,
      message: 'ok',
      data: { ...mockDashboardSummary },
    };
  });
}
