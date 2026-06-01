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
  const dx = Math.abs(x2 - x1) * 0.5
  const cx1 = x1 + dx
  const cy1 = y1
  const cx2 = x2 - dx
  const cy2 = y2
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
}

export function getPortPosition(node: CanvasNode, port: 'input' | 'output'): { x: number; y: number } {
  const centerY = node.y + node.height / 2
  if (port === 'output') {
    return { x: node.x + node.width, y: centerY }
  }
  return { x: node.x, y: centerY }
}

export function initializeNodes(agent: AgentDetailData, subAgents: Array<{ id: string; name: string }>): CanvasNode[] {
  const nodes: CanvasNode[] = []
  nodes.push(createNode('start', 200, 200, { id: 'node-start', label: '开始' }))
  nodes.push(createNode('agent', 440, 200, {
    id: 'node-agent',
    label: agent.name,
    subtitle: '主 Agent',
    avatar: agent.avatar,
  }))
  subAgents.forEach((sub, i) => {
    nodes.push(createNode('subAgent', 440, 310 + i * 80, {
      label: sub.name,
      subtitle: '子 Agent',
    }))
  })
  return nodes
}

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
  return connections
}