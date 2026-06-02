import type { AgentDetailData } from '../agent-detail'
import type { CanvasNode, CanvasConnection, HistoryEntry } from './types'
import { GRID_SIZE, NODE_ID_PREFIX, CONN_ID_PREFIX, NODE_DIMENSIONS } from './constants'

export function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE
}

export function generateId(prefix: string): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createNode(type: CanvasNode['type'], x: number, y: number, overrides?: Partial<CanvasNode>): CanvasNode {
  const dims = NODE_DIMENSIONS[type]
  const label = type === 'start' ? '开始' : type === 'agent' ? '主 Agent' : '子 Agent'
  return {
    id: generateId(NODE_ID_PREFIX),
    type,
    x: snapToGrid(x - dims.width / 2),
    y: snapToGrid(y - dims.height / 2),
    label,
    width: dims.width,
    height: dims.height,
    ...overrides,
  }
}

export function cloneHistory(nodes: CanvasNode[], connections: CanvasConnection[]): HistoryEntry {
  return {
    nodes: nodes.map(n => ({ ...n })),
    connections: connections.map(c => ({ ...c })),
  }
}

export function calculateBezierPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const distX = Math.abs(x2 - x1)
  const offset = Math.max(distX * 0.5, 40)
  const cx1 = x1 + offset
  const cy1 = y1
  const cx2 = x2 - offset
  const cy2 = y2
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
}

export function getPortPosition(node: CanvasNode, port: 'input' | 'output', actualHeight?: number): { x: number; y: number } {
  const h = actualHeight ?? node.height
  const centerY = node.y + h / 2
  if (port === 'output') {
    return { x: node.x + node.width + 4, y: centerY }
  }
  return { x: node.x - 4, y: centerY }
}

const H_GAP = 60
const START_X = 60
const START_Y = 80



export function initializeConnections(nodes: CanvasNode[]): CanvasConnection[] {
  const connections: CanvasConnection[] = []
  const startNode = nodes.find(n => n.type === 'start')
  const agentNode = nodes.find(n => n.type === 'agent')
  if (startNode && agentNode) {
    connections.push({
      id: generateId(CONN_ID_PREFIX),
      fromNodeId: startNode.id,
      toNodeId: agentNode.id,
    })
  }
  const subNodes = nodes.filter(n => n.type === 'subAgent')
  subNodes.forEach((sub) => {
    if (agentNode) {
      connections.push({
        id: generateId(CONN_ID_PREFIX),
        fromNodeId: agentNode.id,
        toNodeId: sub.id,
      })
    }
  })
  return connections
}
export function initializeNodes(agent: AgentDetailData, subAgents: Array<{ id: string; name: string }>): CanvasNode[] {
  const nodes: CanvasNode[] = []

  nodes.push(createNode('start', START_X, START_Y, { id: 'node-start', label: '开始' }))

  const agentX = START_X + NODE_DIMENSIONS.start.width + H_GAP + NODE_DIMENSIONS.agent.width / 2
  nodes.push(createNode('agent', agentX, START_Y, {
    id: 'node-agent',
    label: agent.name,
    subtitle: '主控 Agent',
    avatar: agent.avatar,
    modelName: 'DeepSeek V4 Pro',
    skills: ['插件调用', '知识库检索', '工作流调度'],
    useCase: '用于多 Agent 协作调度，帮助用户将复杂任务拆解并分发给对应子 Agent',
    prompt: '你是一个协调者，接收用户请求后分析任务类型，将子任务分发给合适的子 Agent 执行，汇总结果返回给用户。',
    suggestions: ['帮我总结一下上面的内容', '换一种方式解释', '这个结论的依据是什么'],
    hasUserCustomPrompt: true,
  }))

  subAgents.forEach((sub, i) => {
    const subX = agentX + NODE_DIMENSIONS.agent.width / 2 + H_GAP + NODE_DIMENSIONS.subAgent.width / 2 + i * (NODE_DIMENSIONS.subAgent.width + H_GAP + 40)
    const subY = START_Y - 20 + (i % 2 === 0 ? 0 : 140)
    nodes.push(createNode('subAgent', subX, subY, {
      label: sub.name,
      subtitle: '子 Agent',
      modelName: 'DeepSeek V4 Flash',
      skills: ['意图识别', '对话管理', '上下文理解'],
      useCase: '用于用户意图识别和对话管理，帮助用户解决多轮对话中的上下文理解和意图澄清相关问题',
      prompt: '你是一个对话管理专家，分析用户输入意图，管理对话上下文，确保多轮对话的连贯性和准确性。将分析结果返回给主 Agent。',
      suggestions: ['帮我进一步解释', '这个方案有什么风险', '换一个角度分析'],
      hasUserCustomPrompt: true,
    }))
  })

  return nodes
}