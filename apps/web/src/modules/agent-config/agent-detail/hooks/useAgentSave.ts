import { useState, useCallback, useRef, useEffect } from 'react';
import type { AgentMode } from '../types';
import { updateAgent } from '../../../../api/agent-config/index';
import { bindAgentTools, getPluginDetail } from '../../../../api/plugins';
import { parseOrchestration } from '../utils';
import type { OrchestrationConfig } from '../types';

interface SaveState {
  mode: AgentMode;
  persona: string;
  orchestration: string;
  model: string;
  temperature: number;
  openingMessage: string;
  contextLimit: number;
}

interface UseAgentSaveOptions {
  agentId: string;
  onAgentUpdated: () => void;
  onSaveCompleted: () => void;
}

/** 从编排配置中提取所有插件 ID（去重） */
function collectPluginIds(config: OrchestrationConfig): string[] {
  const ids = new Set<string>();
  for (const section of [config.planner, config.flow, config.multi]) {
    if (section?.plugins) {
      for (const id of section.plugins) {
        ids.add(id);
      }
    }
  }
  return Array.from(ids);
}

/** 同步插件绑定到后端（静默失败，不影响主保存流程） */
async function syncPluginBindings(agentId: string, orchestration: string): Promise<void> {
  try {
    const config = parseOrchestration(orchestration);
    const pluginIds = collectPluginIds(config);

    // 获取各插件详情并收集所有 tool
    const pluginDetails = await Promise.all(
      pluginIds.map((id) => getPluginDetail(id).catch(() => null)),
    );
    const allTools = pluginDetails
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .flatMap((p) => p.tools.filter((t) => t.enabled));

    await bindAgentTools(agentId, allTools);
  } catch (err) {
    console.error('[插件绑定同步失败]', err);
  }
}

export function useAgentSave({ agentId, onAgentUpdated, onSaveCompleted }: UseAgentSaveOptions) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState(false);
  const savingRef = useRef(false);
  const isAutoSavingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStateRef = useRef<SaveState>({
    mode: 'chat' as AgentMode,
    persona: '',
    orchestration: '',
    model: '',
    temperature: 0,
    openingMessage: '',
    contextLimit: 0,
  });

  const doSave = useCallback(async () => {
    const current = saveStateRef.current;
    await updateAgent(agentId, {
      mode: current.mode,
      persona: current.persona,
      orchestration: current.orchestration,
      model: current.model,
      temperature: current.temperature,
      openingMessage: current.openingMessage,
      contextLimit: current.contextLimit,
    });
    // 同步插件绑定到后端（独立于 updateAgent，失败不影响保存成功提示）
    syncPluginBindings(agentId, current.orchestration);
    setSaved(true);
    setAutoSaveError(false);
    setTimeout(() => setSaved(false), 2000);
    onSaveCompleted();
    onAgentUpdated();
  }, [agentId, onAgentUpdated, onSaveCompleted]);

  const performAutoSave = useCallback(async () => {
    if (savingRef.current) return;
    if (isAutoSavingRef.current) return;
    isAutoSavingRef.current = true;
    try {
      await doSave();
    } catch (err) {
      console.error('[自动保存失败]', err);
      setAutoSaveError(true);
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [doSave]);

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    setSaving(true);
    savingRef.current = true;
    try {
      await doSave();
    } catch (err) {
      console.error('[手动保存失败]', err);
      alert('保存失败，请稍后重试');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  return {
    saveStateRef,
    handleSave,
    performAutoSave,
    autoSaveTimerRef,
    saving,
    saved,
    autoSaveError,
    clearAutoSaveError: () => setAutoSaveError(false),
  } as const;
}
