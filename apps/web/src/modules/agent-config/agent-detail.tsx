import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import styles from "./agent-detail.module.css";
import { updateAgent } from "../../api/agent-config/index";
import { SingleAgentPlanner } from "./agent-planner/SingleAgentPlanner";
import { SingleAgentFlow } from "./agent-flow/SingleAgentFlow";
import { MultiAgents } from "./agent-multi/MultiAgents";
import { ModeSelector } from "./components/ModeSelector";
import type { ModeOption } from "./components/ModeSelector";
import { EditAgentModal } from "./components/EditAgentModal";
export type AgentMode = 'chat' | 'single' | 'multi';

export interface AgentDetailData {
  id: string;
  name: string;
  avatar: string;
  description: string;
  mode: AgentMode;
  persona: string;
  orchestration: string;
  model: string;
  temperature: number;
  openingMessage: string;
  contextLimit: number;
}

export interface PlannerConfig {
  selectedModel: string;
  knowledgeEnabled: boolean;
  autoInvoke: boolean;
  plugins: string[];
  workflows: string[];
  fileBoxEnabled: boolean;
  longMemoryEnabled: boolean;
  variables: string[];
  databases: string[];
}

export interface FlowConfig {
  nodes: Array<{ id: string; type: string; x: number; y: number }>;
  variables: string[];
  databases: string[];
}

export interface MultiConfig {
  subAgents: Array<{ id: string; name: string }>;
  plugins: string[];
  workflows: string[];
  triggers: string[];
  variables: string[];
  databases: string[];
  longMemoryEnabled: boolean;
}

export interface OpeningConfig {
  openingMessage: string;
  openingQuestions: string[];
  openingQuestionsEnabled: boolean;
}

export interface OrchestrationConfig {
  planner?: PlannerConfig;
  flow?: FlowConfig;
  multi?: MultiConfig;
  opening?: OpeningConfig;
}

function parseOrchestration(raw: string): OrchestrationConfig {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as OrchestrationConfig;
  } catch {
    // ignore
  }
  return {};
}

function serializeOrchestration(config: OrchestrationConfig): string {
  const cleaned: Record<string, unknown> = {};
  if (config.planner) cleaned.planner = config.planner;
  if (config.flow) cleaned.flow = config.flow;
  if (config.multi) cleaned.multi = config.multi;
  if (config.opening && config.opening.openingMessage) cleaned.opening = config.opening;
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : '';
}

function defaultPlannerConfig(): PlannerConfig {
  return {
    selectedModel: 'deepseek-v4-flash',
    knowledgeEnabled: true,
    autoInvoke: true,
    plugins: [],
    workflows: [],
    fileBoxEnabled: false,
    longMemoryEnabled: false,
    variables: [],
    databases: [],
  };
}

function defaultFlowConfig(): FlowConfig {
  return { nodes: [], variables: [], databases: [] };
}

function defaultMultiConfig(): MultiConfig {
  return {
    subAgents: [],
    plugins: [],
    workflows: [],
    triggers: [],
    variables: [],
    databases: [],
    longMemoryEnabled: false,
  };
}

function defaultOpeningConfig(): OpeningConfig {
  return { openingMessage: '', openingQuestions: [], openingQuestionsEnabled: false };
}

interface Props {
  agent: AgentDetailData;
  onBack: () => void;
  onAgentUpdated: () => void;
}

export const MODE_CONFIG: ModeOption[] = [
  {
    key: 'chat',
    name: '单 Agent（自主规划模式）',
    description: '用户与大模型进行对话，由一个大模型自主思考决策，适用于较为简单的业务逻辑。',
    icon: null,
  },
  {
    key: 'single',
    name: '单 Agent（对话流模式）',
    description: '该智能体会严格按照对话流编排的流程进行执行，支持保留多轮历史对话记录，适用于结构化或有明确流程的任务。',
    icon: null,
  },
  {
    key: 'multi',
    name: '多 Agents',
    description: '在一个智能体中设置多个 Agent，以处理复杂的逻辑。',
    icon: null,
  },
] as ModeOption[];

let contentKeyCounter = 0;
function nextContentKey(): number {
  contentKeyCounter += 1;
  return contentKeyCounter;
}

export function AgentDetail({ agent, onBack, onAgentUpdated }: Props) {
  const [mode, setMode] = useState<AgentMode>(agent.mode);
  const [persona, setPersona] = useState(agent.persona);
  const [orchestration, setOrchestration] = useState(agent.orchestration);
  const [model, setModel] = useState(agent.model);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [contextLimit, setContextLimit] = useState(agent.contextLimit);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [editVisible,setEditVisible] = useState(false);
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
    () => parsedConfig.opening ?? {
      ...defaultOpeningConfig(),
      openingMessage: agent.openingMessage,
    },
    [agent.openingMessage, parsedConfig.opening],
  );

  const updateOrchestration = useCallback(
    (patch: Partial<OrchestrationConfig>) => {
      const next = serializeOrchestration({ ...parsedConfig, ...patch });
      setOrchestration(next);
      setDirty(true);
    },
    [parsedConfig],
  );

  const handlePlannerConfigChange = useCallback(
    (config: PlannerConfig) => {
      updateOrchestration({ planner: config });
      setModel(config.selectedModel);
    },
    [updateOrchestration],
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

  useEffect(() => {
    setMode(agent.mode);
    setPersona(agent.persona);
    setOrchestration(agent.orchestration);
    setModel(agent.model);
    setTemperature(agent.temperature);
    setContextLimit(agent.contextLimit);
  }, [agent.mode, agent.persona, agent.orchestration, agent.model, agent.temperature, agent.contextLimit]);

  const handleModeChange = useCallback(
    (newMode: AgentMode) => {
      if (newMode === mode) return;
      setMode(newMode);
      setDirty(true);
      setContentKey(nextContentKey());
    },
    [mode],
  );

  const handleSave = async () => {
    if (savingRef.current) return;
    setSaving(true);
    savingRef.current = true;
    try {
      await doSave();
    } catch {
      alert('保存失败，请稍后重试');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const saveStateRef = useRef({
    mode,
    persona,
    orchestration,
    model,
    temperature,
    openingMessage: openingConfig.openingMessage,
    contextLimit,
  });
  saveStateRef.current = {
    mode,
    persona,
    orchestration,
    model,
    temperature,
    openingMessage: openingConfig.openingMessage,
    contextLimit,
  };

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoSavingRef = useRef(false);
  const savingRef = useRef(false);

  const doSave = useCallback(async () => {
    const current = saveStateRef.current;
    await updateAgent(agent.id, {
      mode: current.mode,
      persona: current.persona,
      orchestration: current.orchestration,
      model: current.model,
      temperature: current.temperature,
      openingMessage: current.openingMessage,
      contextLimit: current.contextLimit,
    });
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2000);
    onAgentUpdated();
  }, [agent.id, onAgentUpdated]);

  const performAutoSave = useCallback(async () => {
    if (savingRef.current) return;
    if (isAutoSavingRef.current) return;
    isAutoSavingRef.current = true;
    try {
      await doSave();
    } catch {
      // auto-save silently fails
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [doSave]);

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
  }, [dirty, saving, performAutoSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const handlePublish = () => {
    alert(`智能体 "${agent.name}" 发布成功！`);
  };

  const handleModelChange = useCallback(
    (newModel: string) => {
      setModel(newModel);
      setDirty(true);
      // 同步更新 PlannerConfig 里的 selectedModel，保持编排配置里的模型与 Agent 顶层模型一致
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
  const handleEdit = useCallback(()=>{
    setEditVisible(true);
  },[]);
  const handleEditSaved = useCallback(()=>{
    setEditVisible(false);
    onAgentUpdated();
  },[onAgentUpdated]);
  const renderContent = () => {
    const commonProps = {
      agent,
      persona,
      setPersona: handlePersonaChange,
      model,
      onModelChange: handleModelChange,
      temperature,
      onTemperatureChange: handleTemperatureChange,
      contextLimit,
      onContextLimitChange: handleContextLimitChange,
      openingConfig,
      onOpeningChange: handleOpeningConfigChange,
    };

    switch (mode) {
      case 'chat':
        return (
          <SingleAgentPlanner
            {...commonProps}
            config={plannerConfig}
            onConfigChange={handlePlannerConfigChange}
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
            onTemperatureChange={handleTemperatureChange}
            onContextLimitChange={handleContextLimitChange}
            config={flowConfig}
            onConfigChange={handleFlowConfigChange}
            openingConfig={openingConfig}
            onOpeningChange={handleOpeningConfigChange}
          />
        );
      case 'multi':
        return (
          <MultiAgents
            {...commonProps}
            config={multiConfig}
            onConfigChange={handleMultiConfigChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.detailPage}>
      <div className={styles.navbar}>
        <div className={styles.navLeft}>
          <button className={styles.backArrow} onClick={onBack} title="返回">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <img src={agent.avatar} alt={agent.name} className={styles.navAvatar} />
          <span className={styles.navName}>{agent.name}</span>
          <button onClick={handleEdit} className={styles.editBtn} title="编辑">✎</button>
        </div>
        <div className={styles.navCenter}>
          <ModeSelector
            currentMode={mode}
            modes={MODE_CONFIG}
            onModeChange={handleModeChange}
          />
        </div>

        <div className={styles.navRight}>
          {saved && <span className={styles.savedHint}>已保存</span>}
          {dirty && !saved && (
            <span className={styles.draftHint}>
              <span className={styles.draftDot} />
              草稿
            </span>
          )}
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button className={styles.publishBtn} onClick={handlePublish}>
            发布
          </button>
        </div>
      </div>

      <div className={styles.columns} key={contentKey}>
        {renderContent()}
      </div>
      <EditAgentModal
        visible={editVisible}
        agentId={agent.id}
        name={agent.name}
        description={agent.description}
        avatar={agent.avatar}
        onCancel={()=>setEditVisible(false)}
        onSaved={handleEditSaved}
      />
    </div>
  );
}
