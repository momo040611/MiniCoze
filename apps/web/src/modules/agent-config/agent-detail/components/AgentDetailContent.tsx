import React from 'react';
import type { AgentMode, AgentDetailData, PlannerConfig, FlowConfig, MultiConfig, OpeningConfig } from '../types';
import { SingleAgentPlanner } from '../../agent-planner/SingleAgentPlanner';
import { SingleAgentFlow } from '../../agent-flow/SingleAgentFlow';
import { MultiAgents } from '../../agent-multi/MultiAgents';
import { ToolBindSelector } from '../../../plugins/components/ToolBindSelector';
import styles from '../agent-detail.module.css';

interface AgentDetailContentProps {
  mode: AgentMode;
  agent: AgentDetailData;
  persona: string;
  model: string;
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

  return (
    <>
      {modeContent}
      <section className={styles.toolBindingPanel}>
        <div className={styles.toolBindingHeader}>
          <h2>工具绑定</h2>
          <p>选择当前智能体可调用的插件工具，保存后刷新页面仍会保留绑定关系。</p>
        </div>
        <ToolBindSelector agentId={agent.id} />
      </section>
    </>
  );
}
