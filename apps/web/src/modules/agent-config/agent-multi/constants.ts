import type { CanvasNode } from './types'

export const GRID_SIZE = 24
export const MIN_SCALE = 0.25
export const MAX_SCALE = 2
export const NODE_ID_PREFIX = 'node-'
export const CONN_ID_PREFIX = 'conn-'

export const NODE_DIMENSIONS: Record<CanvasNode['type'], { width: number; height: number }> = {
  start: { width: 130, height: 44 },
  agent: { width: 180, height: 52 },
  subAgent: { width: 180, height: 52 },
}