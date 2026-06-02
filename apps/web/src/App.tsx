import { setupAgentMocks } from './api/agent-config';
import { setupAuthMocks } from './api/auth';
import { restoreAuthData } from './api/auth/auth-store';
import { setupDashboardMocks } from './api/dashboard';
import { setupWorkspaceMocks } from './api/workspace';
import { AppRoutes } from './routes/app-routes';

// 通过环境变量 VITE_USE_AUTH_MOCK 控制是否使用 mock 数据
// .env 中设置 VITE_USE_AUTH_MOCK=true 则走 mock 数据
const useAuthMock = import.meta.env.VITE_USE_AUTH_MOCK === 'true';
if (useAuthMock) {
  setupAuthMocks();
  setupWorkspaceMocks();
  setupAgentMocks();
  setupDashboardMocks();
}
restoreAuthData();

export function App() {
  return <AppRoutes />;
}
