import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage, RegisterPage } from '../modules/auth';
import { ArchitecturePage } from '../modules/architecture';
import { CreatAgent } from '../modules/agent-config';
import { AgentDetailPage } from '../modules/agent-config/AgentDetailPage';
import { HomepageIndex } from '../modules/homepage';
import { KnowledgeBasePage, KnowledgeCreate, KnowledgeDetail, KnowledgeList } from '../modules/knowledge-base';
import { Productionline } from '../modules/knowledge-base/page/Productionline';
import { AppLayout } from '../modules/layout/AppLayout';
import { PluginsPage } from '../modules/plugins';
import { ProfilePage } from '../modules/profile';
import { PublishPage } from '../modules/publish';
import { SettingsPage } from '../modules/settings';
import { WelcomePage } from '../modules/welcome';
import { WorkflowCanvasPage } from '../modules/workflow-canvas';
import { WorkflowsPage } from '../modules/workflows';
import { WorkspaceProvider } from '../modules/workspace/workspace-context';
import { RedirectIfAuth, RequireAuth, RootRedirect } from './auth-guard';
import { LegacyRedirectRoutes } from './legacy-redirects';
import { StrictMode, type ReactNode } from 'react';
function ProtectedAppLayout() {
  return (
    <RequireAuth>
      <WorkspaceProvider>
        <AppLayout />
      </WorkspaceProvider>
    </RequireAuth>
  );
}
const strict = (element: ReactNode) => {
  return <StrictMode>{element}</StrictMode>;
};
export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/welcome"
          element={
            <RedirectIfAuth>
              <WelcomePage />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuth>
              <LoginPage />
            </RedirectIfAuth>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuth>
              <RegisterPage />
            </RedirectIfAuth>
          }
        />

        <Route element={strict(<ProtectedAppLayout />)}>
          <Route path="/workspace" element={<HomepageIndex />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/agents" element={<CreatAgent />} />
          <Route path="/agents/:agentId" element={<AgentDetailPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/plugins" element={<PluginsPage />} />
          <Route path="/publish" element={<PublishPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="/knowledge/pipeline" element={<Productionline />} />
          <Route path="/knowledge" element={<KnowledgeBasePage />}>
            <Route index element={<KnowledgeList />} />
            <Route path="create" element={<KnowledgeCreate />} />
            <Route path=":id" element={<KnowledgeDetail />} />
          </Route>
          <Route path="/knowledge-bases" element={<Navigate to="/knowledge/pipeline" replace />} />
          <Route path="/knowledge-bases/productionline" element={<Navigate to="/knowledge/pipeline" replace />} />
        </Route>

        <Route
          path="/workflows/:workflowId"
          element={
            <RequireAuth>
              <WorkflowCanvasPage />
            </RequireAuth>
          }
        />

        {LegacyRedirectRoutes()}
      </Routes>
    </BrowserRouter>
  );
}
