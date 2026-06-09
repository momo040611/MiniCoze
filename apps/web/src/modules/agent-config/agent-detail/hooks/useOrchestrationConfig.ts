import { useState, useMemo, useCallback, useEffect } from 'react';
import type { OrchestrationConfig, PlannerConfig, FlowConfig, MultiConfig, OpeningConfig } from '../types';
import { parseOrchestration, serializeOrchestration, defaultPlannerConfig, defaultFlowConfig, defaultMultiConfig, defaultOpeningConfig } from '../utils';

interface UseOrchestrationConfigOptions {
  initialOrchestration: string;
  agentId: string;
  agentOpeningMessage: string;
  setModel: (model: string) => void;
  setDirty: (dirty: boolean) => void;
}

export function useOrchestrationConfig({
  initialOrchestration,
  agentId,
  agentOpeningMessage,
  setModel,
  setDirty,
}: UseOrchestrationConfigOptions) {
  const [orchestration, setOrchestration] = useState(initialOrchestration);

  useEffect(() => {
    setOrchestration(initialOrchestration);
  }, [agentId]);

  const parsedConfig = useMemo(() => parseOrchestration(orchestration), [orchestration]);

  const plannerConfig = useMemo(
    () => ({ ...defaultPlannerConfig(), ...parsedConfig.planner }),
    [parsedConfig.planner],
  );
  const flowConfig = useMemo(
    () => ({ ...defaultFlowConfig(), ...parsedConfig.flow }),
    [parsedConfig.flow],
  );
  const multiConfig = useMemo(
    () => ({ ...defaultMultiConfig(), ...parsedConfig.multi }),
    [parsedConfig.multi],
  );
  const openingConfig = useMemo(
    () => ({
      ...defaultOpeningConfig(),
      openingMessage: agentOpeningMessage,
      ...parsedConfig.opening,
    }),
    [agentOpeningMessage, parsedConfig.opening],
  );

  const updateOrchestration = useCallback(
    (patch: Partial<OrchestrationConfig>) => {
      const next = serializeOrchestration({ ...parsedConfig, ...patch });
      setOrchestration(next);
      setDirty(true);
    },
    [parsedConfig, setDirty],
  );

  const handlePlannerConfigChange = useCallback(
    (config: PlannerConfig) => {
      updateOrchestration({ planner: config });
      setModel(config.selectedModel);
    },
    [updateOrchestration, setModel],
  );
  const handleFlowConfigChange = useCallback(
    (config: FlowConfig) => updateOrchestration({ flow: config }),
    [updateOrchestration],
  );
  const handleMultiConfigChange = useCallback(
    (config: MultiConfig) => updateOrchestration({ multi: config }),
    [updateOrchestration],
  );
  const handleOpeningConfigChange = useCallback(
    (config: OpeningConfig) => updateOrchestration({ opening: config }),
    [updateOrchestration],
  );

  return {
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
  } as const;
}
