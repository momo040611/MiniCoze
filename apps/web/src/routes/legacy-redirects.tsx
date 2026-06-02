import { Navigate, Route } from 'react-router-dom';

export function LegacyRedirectRoutes() {
  return (
    <>
      <Route path="/homepage" element={<Navigate to="/workspace" replace />} />
      <Route path="/homepage/agent-config" element={<Navigate to="/agents" replace />} />
      <Route path="/homepage/architecture" element={<Navigate to="/architecture" replace />} />
      <Route path="/homepage/workflow-canvas" element={<Navigate to="/workflows" replace />} />
      <Route path="/homepage/knowledge-base" element={<Navigate to="/knowledge" replace />} />
      <Route path="/workflow-canvas" element={<Navigate to="/workflows" replace />} />
      <Route path="/knowledge-base/*" element={<Navigate to="/knowledge" replace />} />
    </>
  );
}
