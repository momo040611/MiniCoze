import { setupAgentMocks } from './api/agent-config';
import { setupAuthMocks } from './api/auth';
import { restoreAuthData } from './api/auth/auth-store';
import { setupProfileMocks } from './api/profile';
import { setupWorkspaceMocks } from './api/workspace';
import { AppRoutes } from './routes/app-routes';

const useAuthMock = import.meta.env.VITE_USE_AUTH_MOCK === 'true';

if (useAuthMock) {
  setupAuthMocks();
  setupWorkspaceMocks();
  setupAgentMocks();
  setupProfileMocks();
}

restoreAuthData();

export function App() {
  return <AppRoutes />;
}
