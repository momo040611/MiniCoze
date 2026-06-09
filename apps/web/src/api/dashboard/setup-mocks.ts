import { registerMockHandler } from '../http';
import { mockDashboardSummary } from './mock-data';

let registered = false;

export function setupDashboardMocks() {
  if (registered) return;
  registered = true;

  registerMockHandler('GET', 'workspaces/default-workspace/dashboard', async () => {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    return {
      code: 0,
      message: 'ok',
      data: { ...mockDashboardSummary },
    };
  });
}
