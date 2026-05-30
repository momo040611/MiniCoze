import { setupAgentMocks } from './api/agent-config';
import { setupAuthMocks } from './api/auth';
import { restoreAuthData } from './api/auth/auth-store';
import { setupWorkspaceMocks } from './api/workspace';
import { AppRoutes } from './routes/app-routes';

const useAuthMock = import.meta.env.VITE_USE_AUTH_MOCK === 'true';

if (useAuthMock) {
  setupAuthMocks();
  setupWorkspaceMocks();
  setupAgentMocks();
}

restoreAuthData();

export function App() {
  return <AppRoutes />;
}
