import { useState, useCallback, useRef, useEffect } from 'react';
import type { AgentMode } from '../types';
import { updateAgent } from '../../../../api/agent-config/index';

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

export function useAgentSave({ agentId, onAgentUpdated, onSaveCompleted }: UseAgentSaveOptions) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
    setSaved(true);
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
    } catch {
      // auto-save silently fails
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
    } catch {
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
  } as const;
}
