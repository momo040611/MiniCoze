import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { WorkspaceProvider } from '../modules/workspace/workspace-context';
import { RedirectIfAuth, RequireAuth, RootRedirect } from './auth-guard';
import { LegacyRedirectRoutes } from './legacy-redirects';
import { StrictMode } from 'react';
import { ErrorBoundary } from '../modules/homepage/components/ErrorBoundary';
import { AppLayout } from '../modules/layout/AppLayout';

// ── 懒加载页面组件 ──
const LoginPage = lazy(() => import('../modules/auth').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../modules/auth').then(m => ({ default: m.RegisterPage })));
const WelcomePage = lazy(() => import('../modules/welcome').then(m => ({ default: m.WelcomePage })));
const DashboardPage = lazy(() => import('../modules/homepage').then(m => ({ default: m.DashboardPage })));
const HomepageIndex = lazy(() => import('../modules/homepage').then(m => ({ default: m.HomepageIndex })));
const ProfilePage = lazy(() => import('../modules/profile').then(m => ({ default: m.ProfilePage })));
const CreatAgent = lazy(() => import('../modules/agent-config').then(m => ({ default: m.CreatAgent })));
const AgentDetailPage = lazy(() => import('../modules/agent-config/AgentDetailPage').then(m => ({ default: m.AgentDetailPage })));
const WorkflowsPage = lazy(() => import('../modules/workflows').then(m => ({ default: m.WorkflowsPage })));
const PluginsPage = lazy(() => import('../modules/plugins').then(m => ({ default: m.PluginsPage })));
const PluginDetail = lazy(() => import('../modules/plugins').then(m => ({ default: m.PluginDetail })));
const PublishPage = lazy(() => import('../modules/publish').then(m => ({ default: m.PublishPage })));
const SettingsPage = lazy(() => import('../modules/settings').then(m => ({ default: m.SettingsPage })));
const ArchitecturePage = lazy(() => import('../modules/architecture').then(m => ({ default: m.ArchitecturePage })));
const WorkflowCanvasPage = lazy(() => import('../modules/workflow-canvas').then(m => ({ default: m.WorkflowCanvasPage })));
const KnowledgeBasePage = lazy(() => import('../modules/knowledge-base').then(m => ({ default: m.KnowledgeBasePage })));
const KnowledgeList = lazy(() => import('../modules/knowledge-base').then(m => ({ default: m.KnowledgeList })));
const KnowledgeCreate = lazy(() => import('../modules/knowledge-base').then(m => ({ default: m.KnowledgeCreate })));
const KnowledgeDetail = lazy(() => import('../modules/knowledge-base').then(m => ({ default: m.KnowledgeDetail })));
const Productionline = lazy(() => import('../modules/knowledge-base/page/Productionline').then(m => ({ default: m.Productionline })));
const WorkspaceSettings = lazy(() => import('../modules/workspace/WorkspaceSettings').then(m => ({ default: m.WorkspaceSettings })));

// ── 加载指示器 ──
function PageLoading() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
    }}>
      <Spin size="large" tip="加载中..." />
    </div>
  );
}

// ── 路由守卫包装 ──
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

// ── Suspense 包装的路由元素 ──
const withSuspense = (Component: React.LazyExoticComponent<() => React.ReactElement | null>) => (
  <Suspense fallback={<PageLoading />}>
    <Component />
  </Suspense>
);

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/welcome"
          element={
            <RedirectIfAuth>
              {withSuspense(WelcomePage)}
            </RedirectIfAuth>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuth>
              {withSuspense(LoginPage)}
            </RedirectIfAuth>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuth>
              {withSuspense(RegisterPage)}
            </RedirectIfAuth>
          }
        />

        <Route element={strict(<ProtectedAppLayout />)}>
          <Route path="/workspace" element={withSuspense(DashboardPage)} />
          <Route path="/workspace/chat" element={withSuspense(HomepageIndex)} />
          <Route path="/workspace/settings" element={withSuspense(WorkspaceSettings)} />
          <Route path="/profile" element={withSuspense(ProfilePage)} />
          <Route path="/agents" element={withSuspense(CreatAgent)} />
          <Route path="/agents/:agentId" element={withSuspense(AgentDetailPage)} />
          <Route path="/workflows" element={withSuspense(WorkflowsPage)} />
          <Route path="/plugins" element={withSuspense(PluginsPage)} />
          <Route path="/plugins/:pluginId" element={withSuspense(PluginDetail)} />
          <Route path="/publish" element={withSuspense(PublishPage)} />
          <Route path="/settings" element={withSuspense(SettingsPage)} />
          <Route path="/architecture" element={withSuspense(ArchitecturePage)} />
          <Route path="/knowledge/pipeline" element={withSuspense(Productionline)} />
          <Route path="/knowledge" element={withSuspense(KnowledgeBasePage)}>
            <Route index element={withSuspense(KnowledgeList)} />
            <Route path="create" element={withSuspense(KnowledgeCreate)} />
            <Route path=":id" element={withSuspense(KnowledgeDetail)} />
          </Route>
          <Route path="/knowledge-bases" element={<Navigate to="/knowledge/pipeline" replace />} />
          <Route path="/knowledge-bases/productionline" element={<Navigate to="/knowledge/pipeline" replace />} />
        </Route>

        <Route
          path="/workflows/:workflowId"
          element={
            <RequireAuth>
              {withSuspense(WorkflowCanvasPage)}
            </RequireAuth>
          }
        />

        {LegacyRedirectRoutes()}
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
