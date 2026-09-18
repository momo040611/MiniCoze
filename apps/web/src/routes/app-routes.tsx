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
const SharePage = lazy(() => import('../modules/publish/components/SharePage').then(m => ({ default: m.SharePage })));
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

/** 默认所有页面都在 StrictMode 下；只有内嵌 Flowgram 画布的智能体配置页例外 */
const withStrictSuspense = (Component: React.LazyExoticComponent<() => React.ReactElement | null>) =>
  strict(withSuspense(Component));

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/share/agents/:slug" element={withSuspense(SharePage)} />
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

        {/* 单一布局实例：拆成两个布局路由会让应用外壳在页面间切换时被整体重建。
            StrictMode 只对智能体配置页关闭——它内嵌的 Flowgram 画布 DI 容器
            不兼容 StrictMode 的双挂载（Ambiguous match for FlowRendererRegistry）。 */}
        <Route element={<ProtectedAppLayout />}>
          <Route path="/agents" element={withSuspense(CreatAgent)} />
          <Route path="/agents/:agentId" element={withSuspense(AgentDetailPage)} />
          <Route path="/workspace" element={withStrictSuspense(DashboardPage)} />
          <Route path="/workspace/chat" element={withStrictSuspense(HomepageIndex)} />
          <Route path="/workspace/settings" element={withStrictSuspense(WorkspaceSettings)} />
          <Route path="/profile" element={withStrictSuspense(ProfilePage)} />
          <Route path="/workflows" element={withStrictSuspense(WorkflowsPage)} />
          <Route path="/plugins" element={withStrictSuspense(PluginsPage)} />
          <Route path="/plugins/:pluginId" element={withStrictSuspense(PluginDetail)} />
          <Route path="/publish" element={withStrictSuspense(PublishPage)} />
          <Route path="/settings" element={withStrictSuspense(SettingsPage)} />
          <Route path="/architecture" element={withStrictSuspense(ArchitecturePage)} />
          <Route path="/knowledge/pipeline" element={withStrictSuspense(Productionline)} />
          <Route path="/knowledge" element={withStrictSuspense(KnowledgeBasePage)}>
            <Route index element={withStrictSuspense(KnowledgeList)} />
            <Route path="create" element={withStrictSuspense(KnowledgeCreate)} />
            <Route path=":id" element={withStrictSuspense(KnowledgeDetail)} />
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
