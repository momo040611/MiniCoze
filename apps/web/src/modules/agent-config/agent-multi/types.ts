export interface CanvasNode {
  id: string
  type: 'start' | 'agent' | 'subAgent'
  x: number
  y: number
  label: string
  subtitle?: string
  avatar?: string
  width: number
  height: number
  modelName?: string
  skills?: string[]
  useCase?: string
  prompt?: string
  suggestions?: string[]
  hasUserCustomPrompt?: boolean
}

export interface CanvasConnection {
  id: string
  fromNodeId: string
  toNodeId: string
}

export interface HistoryEntry {
  nodes: CanvasNode[]
  connections: CanvasConnection[]
}

export interface DragInfo {
  nodeId: string
  startX: number
  startY: number
  nodeStartX: number
  nodeStartY: number
}

export interface ConnectingFrom {
  nodeId: string
  x: number
  y: number
}
