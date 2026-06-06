import type { OrchestrationConfig, PlannerConfig, FlowConfig, MultiConfig, OpeningConfig } from './types';
import { DEFAULT_AGENT_MODEL } from '../../../api/agent-config/model-options';

export function parseOrchestration(raw: string): OrchestrationConfig {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as OrchestrationConfig;
  } catch {
    // ignore
  }
  return {};
}

export function serializeOrchestration(config: OrchestrationConfig): string {
  const cleaned: Record<string, unknown> = {};
  if (config.planner) cleaned.planner = config.planner;
  if (config.flow) cleaned.flow = config.flow;
  if (config.multi) cleaned.multi = config.multi;
  if (config.opening && (config.opening.openingMessage || config.opening.openingQuestions?.length || config.opening.openingQuestionsEnabled)) cleaned.opening = config.opening;
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : '';
}

export function defaultPlannerConfig(): PlannerConfig {
  return {
    selectedModel: DEFAULT_AGENT_MODEL,
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

export function defaultFlowConfig(): FlowConfig {
  return { nodes: [], workflows: [], variables: [], databases: [] };
}

export function defaultMultiConfig(): MultiConfig {
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

export function defaultOpeningConfig(): OpeningConfig {
  return { openingMessage: '', openingQuestions: [], openingQuestionsEnabled: false };
}
