import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AgentDetail, type AgentDetailData } from './agent-detail';
import { getAgentDetail } from '../../api/agent-config/index';
export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadAgent = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await getAgentDetail(agentId);
      if (!detail) {
        setError('智能体不存在');
        return;
      }
      const detailData: AgentDetailData = {
        id: detail.id,
        name: detail.name,
        avatar: detail.avatar,
        description: detail.description,
        mode: detail.mode,
        persona: detail.persona,
        orchestration: detail.orchestration,
        model: detail.model ?? 'deepseek-v4-flash',
        temperature: detail.temperature ?? 0.7,
        openingMessage: detail.openingMessage ?? '',
        contextLimit: detail.contextLimit ?? 20,
      };
      setAgent(detailData);
    } catch {
      setError('加载智能体失败');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const refreshAgent = useCallback(async () => {
    if (!agentId) return;
    try {
      const detail = await getAgentDetail(agentId);
      if (!detail) return;
      const detailData: AgentDetailData = {
        id: detail.id,
        name: detail.name,
        avatar: detail.avatar,
        description: detail.description,
        mode: detail.mode,
        persona: detail.persona,
        orchestration: detail.orchestration,
        model: detail.model ?? 'deepseek-v4-flash',
        temperature: detail.temperature ?? 0.7,
        openingMessage: detail.openingMessage ?? '',
        contextLimit: detail.contextLimit ?? 20,
      };
      setAgent(detailData);
    } catch {
      // silently ignore refresh failures
    }
  }, [agentId]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const handleBack = useCallback(() => {
    navigate('/agents');
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <span>加载中...</span>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 16 }}>
        <span>{error ?? '智能体不存在'}</span>
        <button onClick={handleBack}>返回列表</button>
      </div>
    );
  }
  return <AgentDetail agent={agent} onBack={handleBack} onAgentUpdated={refreshAgent} />;
}
