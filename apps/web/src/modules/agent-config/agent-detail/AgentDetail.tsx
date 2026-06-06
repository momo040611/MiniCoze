import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './agent-detail.module.css';
import type { AgentMode, AgentDetailData } from './types';
import { MODEL_OPTIONS } from '../../../api/agent-config/model-options';
import { useOrchestrationConfig } from './hooks/useOrchestrationConfig';
import { useAgentSave } from './hooks/useAgentSave';
import { nextContentKey } from './constants';
import { AgentDetailNavbar } from './components/AgentDetailNavbar';
import { AgentDetailContent } from './components/AgentDetailContent';
import { EditAgentModal } from '../components/EditAgentModal';
import {
  checkAgent,
  publishAgent,
  offlineAgent,
} from '../../../api/publish/index';

interface Props {
  agent: AgentDetailData;
  onBack: () => void;
  onAgentUpdated: () => void;
}

export function AgentDetail({ agent, onBack, onAgentUpdated }: Props) {
  const [mode, setMode] = useState<AgentMode>(agent.mode);
  const [persona, setPersona] = useState(agent.persona);
  const [model, setModel] = useState(agent.model);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [contextLimit, setContextLimit] = useState(agent.contextLimit);
  const [contentKey, setContentKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [status, setStatus] = useState(agent.status);
  const [publishing, setPublishing] = useState(false);
  const isPublished = status === 'ACTIVE';

  const {
    orchestration,
    parsedConfig,
    plannerConfig,
    flowConfig,
    multiConfig,
    openingConfig,
    updateOrchestration,
    handlePlannerConfigChange,
    handleFlowConfigChange,
    handleMultiConfigChange,
    handleOpeningConfigChange,
  } = useOrchestrationConfig({
    initialOrchestration: agent.orchestration,
    agentId: agent.id,
    agentOpeningMessage: agent.openingMessage,
    setModel,
    setDirty,
  });

  const {
    saveStateRef,
    handleSave,
    performAutoSave,
    autoSaveTimerRef,
    saving,
    saved,
    autoSaveError,
    clearAutoSaveError,
  } = useAgentSave({ agentId: agent.id, onAgentUpdated, onSaveCompleted: () => setDirty(false) });

  saveStateRef.current = {
    mode,
    persona,
    orchestration,
    model,
    temperature,
    openingMessage: openingConfig.openingMessage,
    contextLimit,
  };

  const prevAgentIdRef = useRef(agent.id);

  useEffect(() => {
    if (prevAgentIdRef.current !== agent.id) {
      prevAgentIdRef.current = agent.id;
      setMode(agent.mode);
      setPersona(agent.persona);
      setModel(agent.model);
      setTemperature(agent.temperature);
      setContextLimit(agent.contextLimit);
      setStatus(agent.status);
      setDirty(false);
    }
  }, [agent.id, agent.mode, agent.persona, agent.model, agent.temperature, agent.contextLimit, agent.status]);

  const handleModeChange = useCallback(
    (newMode: AgentMode) => {
      if (newMode === mode) return;
      setMode(newMode);
      setDirty(true);
      setContentKey(nextContentKey());
    },
    [mode],
  );

  useEffect(() => {
    if (!dirty || saving || isPublished) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [dirty, saving, performAutoSave, autoSaveTimerRef, isPublished]);

  const handlePublish = useCallback(async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      if (isPublished) {
        // 下线：调用专用下线接口
        await offlineAgent(agent.id);
        setStatus('DRAFT');
      } else {
        // 发布：先保存草稿，再执行发布流程
        if (dirty) {
          await handleSave();
        }
        // 1. 检查是否满足发布条件
        const checkResult = await checkAgent(agent.id);
        if (!checkResult.passed) {
          const failedMessages = checkResult.items
            .filter((item) => !item.passed)
            .map((item) => item.message ?? item.label)
            .join('\n');
          alert(`发布检查未通过：\n${failedMessages}`);
          return;
        }
        // 2. 执行发布（创建版本快照）
        await publishAgent(agent.id);
        setStatus('ACTIVE');
      }
      onAgentUpdated();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '操作失败';
      alert(isPublished ? `下线失败：${message}` : `发布失败：${message}`);
    } finally {
      setPublishing(false);
    }
  }, [agent.id, isPublished, publishing, dirty, handleSave, onAgentUpdated]);

  const handleModelChange = useCallback(
    (newModel: string) => {
      setModel(newModel);
      setDirty(true);
      if (parsedConfig.planner) {
        updateOrchestration({ planner: { ...parsedConfig.planner, selectedModel: newModel } });
      }
    },
    [parsedConfig, updateOrchestration],
  );

  const handleTemperatureChange = useCallback((value: number) => {
    setTemperature(value);
    setDirty(true);
  }, []);

  const handleContextLimitChange = useCallback((value: number) => {
    setContextLimit(value);
    setDirty(true);
  }, []);

  const handlePersonaChange = useCallback((value: string) => {
    setPersona(value);
    setDirty(true);
  }, []);

  const handleEdit = useCallback(() => {
    setEditVisible(true);
  }, []);

  const handleEditSaved = useCallback(() => {
    setEditVisible(false);
    onAgentUpdated();
  }, [onAgentUpdated]);

  return (
    <div className={styles.detailPage}>
      <AgentDetailNavbar
        agentName={agent.name}
        agentAvatar={agent.avatar}
        mode={mode}
        saving={saving}
        saved={saved}
        autoSaveError={autoSaveError}
        dirty={dirty}
        status={status}
        publishing={publishing}
        onBack={onBack}
        onEdit={handleEdit}
        onModeChange={handleModeChange}
        onSave={handleSave}
        onPublish={handlePublish}
      />
      <div className={styles.columns} key={contentKey}>
        <AgentDetailContent
          mode={mode}
          agent={agent}
          persona={persona}
          model={model}
          modelOptions={MODEL_OPTIONS}
          temperature={temperature}
          contextLimit={contextLimit}
          plannerConfig={plannerConfig}
          flowConfig={flowConfig}
          multiConfig={multiConfig}
          openingConfig={openingConfig}
          isPublished={isPublished}
          onPersonaChange={handlePersonaChange}
          onModelChange={handleModelChange}
          onTemperatureChange={handleTemperatureChange}
          onContextLimitChange={handleContextLimitChange}
          onPlannerConfigChange={handlePlannerConfigChange}
          onFlowConfigChange={handleFlowConfigChange}
          onMultiConfigChange={handleMultiConfigChange}
          onOpeningChange={handleOpeningConfigChange}
        />
      </div>
      <EditAgentModal
        visible={editVisible}
        agentId={agent.id}
        name={agent.name}
        description={agent.description}
        avatar={agent.avatar}
        onCancel={() => setEditVisible(false)}
        onSaved={handleEditSaved}
      />
    </div>
  );
}
