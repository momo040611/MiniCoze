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
