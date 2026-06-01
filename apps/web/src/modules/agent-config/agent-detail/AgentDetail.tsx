import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './agent-detail.module.css';
import type { AgentMode, AgentDetailData } from './types';
import { useOrchestrationConfig } from './hooks/useOrchestrationConfig';
import { useAgentSave } from './hooks/useAgentSave';
import { nextContentKey } from './constants';
import { AgentDetailNavbar } from './components/AgentDetailNavbar';
import { AgentDetailContent } from './components/AgentDetailContent';
import { EditAgentModal } from '../components/EditAgentModal';

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
      setDirty(false);
    }
  }, [agent.id, agent.mode, agent.persona, agent.model, agent.temperature, agent.contextLimit]);

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
    if (!dirty || saving) return;

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
  }, [dirty, saving, performAutoSave, autoSaveTimerRef]);

  const handlePublish = () => {
    alert(`智能体 "${agent.name}" 发布成功！`);
  };

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
        dirty={dirty}
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
          temperature={temperature}
          contextLimit={contextLimit}
          plannerConfig={plannerConfig}
          flowConfig={flowConfig}
          multiConfig={multiConfig}
          openingConfig={openingConfig}
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
