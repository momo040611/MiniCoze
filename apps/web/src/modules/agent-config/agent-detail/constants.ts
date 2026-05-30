import type { ModeOption } from '../components/ModeSelector';

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
export function nextContentKey(): number {
  contentKeyCounter += 1;
  return contentKeyCounter;
}
