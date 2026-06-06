import React from 'react';
import type { AgentMode, AgentDetailData, PlannerConfig, FlowConfig, MultiConfig, OpeningConfig } from '../types';
import type { ModelOption } from '../../../../api/agent-config/model-options';
import { SingleAgentPlanner } from '../../agent-planner/SingleAgentPlanner';
import { SingleAgentFlow } from '../../agent-flow/SingleAgentFlow';
import { MultiAgents } from '../../agent-multi/MultiAgents';
interface AgentDetailContentProps {
  mode: AgentMode;
  agent: AgentDetailData;
  persona: string;
  model: string;
  modelOptions: ModelOption[];
  temperature: number;
  contextLimit: number;
  plannerConfig: PlannerConfig;
  flowConfig: FlowConfig;
  multiConfig: MultiConfig;
  openingConfig: OpeningConfig;
  onPersonaChange: (value: string) => void;
  onModelChange: (model: string) => void;
  onTemperatureChange: (value: number) => void;
  onContextLimitChange: (value: number) => void;
  onPlannerConfigChange: (config: PlannerConfig) => void;
  onFlowConfigChange: (config: FlowConfig) => void;
  onMultiConfigChange: (config: MultiConfig) => void;
  onOpeningChange: (config: OpeningConfig) => void;
}

export function AgentDetailContent({
  mode,
  agent,
  persona,
  model,
  modelOptions,
  temperature,
  contextLimit,
  plannerConfig,
  flowConfig,
  multiConfig,
  openingConfig,
  onPersonaChange,
  onModelChange,
  onTemperatureChange,
  onContextLimitChange,
  onPlannerConfigChange,
  onFlowConfigChange,
  onMultiConfigChange,
  onOpeningChange,
}: AgentDetailContentProps) {
  const commonProps = {
    agent,
    persona,
    setPersona: onPersonaChange,
    model,
    modelOptions,
    onModelChange,
    temperature,
    onTemperatureChange,
    contextLimit,
    onContextLimitChange,
    openingConfig,
    onOpeningChange,
  };

  const modeContent = (() => {
    switch (mode) {
    case 'chat':
      return (
        <SingleAgentPlanner
          {...commonProps}
          config={plannerConfig}
          onConfigChange={onPlannerConfigChange}
        />
      );
    case 'single':
      return (
        <SingleAgentFlow
          agent={agent}
          persona={persona}
          model={model}
          modelOptions={modelOptions}
          onModelChange={onModelChange}
          temperature={temperature}
          contextLimit={contextLimit}
          onTemperatureChange={onTemperatureChange}
          onContextLimitChange={onContextLimitChange}
          config={flowConfig}
          onConfigChange={onFlowConfigChange}
          openingConfig={openingConfig}
          onOpeningChange={onOpeningChange}
        />
      );
    case 'multi':
      return (
        <MultiAgents
          {...commonProps}
          config={multiConfig}
          onConfigChange={onMultiConfigChange}
        />
      );
    default:
      return null;
    }
  })();

  return <>{modeContent}</>;
}
