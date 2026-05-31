import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { AgentDetailData } from '../../agent-detail'
import type { CanvasNode, CanvasConnection, HistoryEntry, DragInfo, ConnectingFrom } from '../types'
import {
  snapToGrid, generateId, createNode, cloneHistory,
  calculateBezierPath, getPortPosition,
  initializeNodes, initializeConnections,
} from '../utils'
import { MIN_SCALE, MAX_SCALE, CONN_ID_PREFIX } from '../constants'

interface UseCanvasOptions {
  agent: AgentDetailData
  subAgents: Array<{ id: string; name: string }>
}

export function useCanvas({ agent, subAgents }: UseCanvasOptions) {
  const viewportRef = useRef<HTMLDivElement>(null)

  const initialNodes = useMemo(
    () => initializeNodes(agent, subAgents),
    [agent, subAgents],
  )
  const initialConnections = useMemo(
    () => initializeConnections(initialNodes),
    [initialNodes],
  )

  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes)
  const [connections, setConnections] = useState<CanvasConnection[]>(initialConnections)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const [history, setHistory] = useState<HistoryEntry[]>([cloneHistory(initialNodes, initialConnections)])
  const [historyIndex, setHistoryIndex] = useState(0)

  const [connectingFrom, setConnectingFrom] = useState<ConnectingFrom | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null)
  const [showNodeMenu, setShowNodeMenu] = useState(false)

  const pushHistory = useCallback((newNodes: CanvasNode[], newConns: CanvasConnection[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1)
      return [...trimmed, cloneHistory(newNodes, newConns)]
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const handleUndo = useCallback(() => {
    if (!canUndo) return
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    const entry = history[newIndex]
    setNodes(entry.nodes.map(n => ({ ...n })))
    setConnections(entry.connections.map(c => ({ ...c })))
  }, [canUndo, historyIndex, history])

  const handleRedo = useCallback(() => {
    if (!canRedo) return
    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    const entry = history[newIndex]
    setNodes(entry.nodes.map(n => ({ ...n })))
    setConnections(entry.connections.map(c => ({ ...c })))
  }, [canRedo, historyIndex, history])

  const addNode = useCallback((type: CanvasNode['type'], label?: string, subtitle?: string) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const cx = (rect.width / 2 - offset.x) / scale
    const cy = (rect.height / 2 - offset.y) / scale
    const newNode = createNode(type, cx, cy, label ? { label, subtitle } : undefined)
    const newNodes = [...nodes, newNode]
    setNodes(newNodes)
    pushHistory(newNodes, connections)
    setShowNodeMenu(false)
  }, [nodes, connections, offset, scale, pushHistory])

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return
    if (selectedNodeId === 'node-start') return
    const newNodes = nodes.filter(n => n.id !== selectedNodeId)
    const newConns = connections.filter(
      c => c.fromNodeId !== selectedNodeId && c.toNodeId !== selectedNodeId,
    )
    setNodes(newNodes)
    setConnections(newConns)
    setSelectedNodeId(null)
    pushHistory(newNodes, newConns)
  }, [selectedNodeId, nodes, connections, pushHistory])

  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      setIsPanning(true)
      setDragInfo(null)
      setSelectedNodeId(null)
      setConnectingFrom(null)
      return
    }
    if (e.button === 0 && e.target === e.currentTarget) {
      setSelectedNodeId(null)
      setConnectingFrom(null)
    }
  }, [])

  const handleViewportMouseMove = useCallback((e: React.MouseEvent) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const mx = (e.clientX - rect.left - offset.x) / scale
    const my = (e.clientY - rect.top - offset.y) / scale

    if (dragInfo) {
      const newNodes = nodes.map(n => {
        if (n.id !== dragInfo.nodeId) return n
        return {
          ...n,
          x: snapToGrid(dragInfo.nodeStartX + (mx - dragInfo.startX)),
          y: snapToGrid(dragInfo.nodeStartY + (my - dragInfo.startY)),
        }
      })
      setNodes(newNodes)
      return
    }

    if (isPanning) {
      setOffset(prev => ({
        x: prev.x + (e.movementX || 0),
        y: prev.y + (e.movementY || 0),
      }))
    }
  }, [dragInfo, isPanning, nodes, offset, scale])

  const handleViewportMouseUp = useCallback(() => {
    if (dragInfo) {
      pushHistory(nodes, connections)
    }
    setDragInfo(null)
    setIsPanning(false)
  }, [dragInfo, nodes, connections, pushHistory])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const mx = (e.clientX - rect.left - offset.x) / scale
    const my = (e.clientY - rect.top - offset.y) / scale
    const targetNode = nodes.find(n => n.id === nodeId)
    if (!targetNode) return
    setSelectedNodeId(nodeId)
    setIsPanning(false)
    setConnectingFrom(null)
    setDragInfo({
      nodeId,
      startX: mx,
      startY: my,
      nodeStartX: targetNode.x,
      nodeStartY: targetNode.y,
    })
  }, [nodes, offset, scale])

  const handlePortMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    const portPos = getPortPosition(node, 'output')
    setConnectingFrom({ nodeId, x: portPos.x, y: portPos.y })
    setDragInfo(null)
    setIsPanning(false)
  }, [nodes])

  const handlePortMouseUp = useCallback((e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (!connectingFrom) return
    if (connectingFrom.nodeId === targetNodeId) {
      setConnectingFrom(null)
      return
    }
    const exists = connections.some(
      c => c.fromNodeId === connectingFrom.nodeId && c.toNodeId === targetNodeId,
    )
    if (!exists) {
      const newConn: CanvasConnection = {
        id: generateId(CONN_ID_PREFIX),
        fromNodeId: connectingFrom.nodeId,
        toNodeId: targetNodeId,
      }
      const newConns = [...connections, newConn]
      setConnections(newConns)
      pushHistory(nodes, newConns)
    }
    setConnectingFrom(null)
  }, [connectingFrom, connections, nodes, pushHistory])

  const handleCanvasMouseUp = useCallback(() => {
    setConnectingFrom(null)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const direction = e.deltaY > 0 ? -1 : 1
      const factor = 1.1
      setScale((prevScale) => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale * (direction > 0 ? factor : 1 / factor)))
        setOffset((prevOffset) => {
          const newOffsetX = mx - (mx - prevOffset.x) * (newScale / prevScale)
          const newOffsetY = my - (my - prevOffset.y) * (newScale / prevScale)
          return { x: newOffsetX, y: newOffsetY }
        })
        return newScale
      })
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
        deleteSelectedNode()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        handleRedo()
      }
      if (e.key === '0' && e.ctrlKey) {
        e.preventDefault()
        setScale(1)
        setOffset({ x: 0, y: 0 })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedNode, handleUndo, handleRedo])

  const handleZoomIn = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const newScale = Math.min(MAX_SCALE, scale * 1.15)
    setScale(newScale)
    setOffset({
      x: cx - (cx - offset.x) * (newScale / scale),
      y: cy - (cy - offset.y) * (newScale / scale),
    })
  }, [scale, offset])

  const handleZoomOut = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const newScale = Math.max(MIN_SCALE, scale / 1.15)
    setScale(newScale)
    setOffset({
      x: cx - (cx - offset.x) * (newScale / scale),
      y: cy - (cy - offset.y) * (newScale / scale),
    })
  }, [scale, offset])

  const handleResetView = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setSelectedNodeId(null)
  }, [])

  const handleFitContent = useCallback(() => {
    if (nodes.length === 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const minX = Math.min(...nodes.map(n => n.x))
    const minY = Math.min(...nodes.map(n => n.y))
    const maxX = Math.max(...nodes.map(n => n.x + n.width))
    const maxY = Math.max(...nodes.map(n => n.y + n.height))
    const contentW = maxX - minX + 100
    const contentH = maxY - minY + 100
    const scaleX = (rect.width - 80) / contentW
    const scaleY = (rect.height - 80) / contentH
    const newScale = Math.min(scaleX, scaleY, 1.5)
    setScale(newScale)
    setOffset({
      x: (rect.width - contentW * newScale) / 2 - minX * newScale + 40,
      y: (rect.height - contentH * newScale) / 2 - minY * newScale + 40,
    })
  }, [nodes])

  const toggleFullscreen = useCallback(() => {
    const el = viewportRef.current?.closest('[class*="col"]') as HTMLElement | null
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    setOffset({ x: rect.width / 4, y: rect.height / 4 })
  }, [])

  const zoomPercent = Math.round(scale * 100)

  const handleConnectionClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [])

  const nodeMap = useMemo(() => {
    const map = new Map<string, CanvasNode>()
    nodes.forEach(n => map.set(n.id, n))
    return map
  }, [nodes])

  return {
    viewportRef,
    nodes,
    connections,
    selectedNodeId,
    scale,
    offset,
    canUndo,
    canRedo,
    connectingFrom,
    isPanning,
    dragInfo,
    showNodeMenu,
    setShowNodeMenu,
    nodeMap,
    zoomPercent,
    addNode,
    handleUndo,
    handleRedo,
    handleViewportMouseDown,
    handleViewportMouseMove,
    handleViewportMouseUp,
    handleNodeMouseDown,
    handlePortMouseDown,
    handlePortMouseUp,
    handleCanvasMouseUp,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleFitContent,
    toggleFullscreen,
    handleConnectionClick,
  } as const
}

export { calculateBezierPath, getPortPosition }