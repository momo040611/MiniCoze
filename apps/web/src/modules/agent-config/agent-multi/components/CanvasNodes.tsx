import React, { useState, useCallback, useLayoutEffect, useRef } from 'react'
import multiStyles from '../MultiAgents.module.css'
import type { CanvasNode } from '../types'

interface NodeRendererProps {
  node: CanvasNode
  isSelected: boolean
  isDragging: boolean
  connectingFromNodeId: string | null
  onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void
  onPortMouseDown: (e: React.MouseEvent, nodeId: string) => void
  onPortMouseUp: (e: React.MouseEvent, nodeId: string) => void
  onNodeResize?: (nodeId: string, height: number) => void
  getNodeClass: (node: CanvasNode) => string
}

function ArrowRight() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3.5 2.5L6.5 5L3.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M3 1.5L10 6L3 10.5V1.5Z" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <circle cx="3" cy="6" r="1.2" />
      <circle cx="6" cy="6" r="1.2" />
      <circle cx="9" cy="6" r="1.2" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <circle cx="5" cy="5" r="4.3" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <path d="M4.5 7.5h1M5 4.5V3a1.5 1.5 0 011.5 1.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function ModelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1L10 3.5V8.5L6 11L2 8.5V3.5L6 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M5 2V8M2 5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface PanelSection {
  key: string
  title: string
  extra?: React.ReactNode
  defaultOpen?: boolean
  content: React.ReactNode
}

function usePanels() {
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>(() => ({
    model: true,
    scene: true,
    prompt: true,
    skill: true,
    question: true,
  }))

  const toggle = useCallback((key: string) => {
    setOpenPanels(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return { openPanels, toggle }
}

function AgentNode({ node, isSelected, connectingFromNodeId, onNodeMouseDown, onPortMouseDown, onPortMouseUp, onNodeResize, getNodeClass }: NodeRendererProps) {
  const { openPanels, toggle } = usePanels()
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (containerRef.current && onNodeResize) {
      onNodeResize(node.id, containerRef.current.offsetHeight)
    }
  }, [node.id, onNodeResize, openPanels])

  const panels: PanelSection[] = [
    {
      key: 'model',
      title: '模型设置',
      defaultOpen: true,
      content: (
        <div className={multiStyles.modelSelectWrap}>
          <div className={multiStyles.modelSelectIcon}><ModelIcon /></div>
          <span className={multiStyles.modelSelectName}>{node.modelName || '默认模型'}</span>
          <span className={multiStyles.modelSelectChevron}><ChevronDown /></span>
        </div>
      ),
    },
    {
      key: 'scene',
      title: '适用场景',
      extra: (
        <>
          <span className={multiStyles.panelTitleRequired}>*</span>
          <span className={multiStyles.panelTitleHelp} title="必填项">
            <HelpIcon />
          </span>
        </>
      ),
      content: (
        <div className={multiStyles.sceneText}>{node.useCase || '暂未设置'}</div>
      ),
    },
    {
      key: 'prompt',
      title: 'Agent 提示词',
      content: (
        <div className={multiStyles.promptText}>{node.prompt || '暂未设置'}</div>
      ),
    },
    {
      key: 'skill',
      title: '技能',
      extra: (
        <span className={multiStyles.panelTitleAction}>
          <PlusIcon />
          <span>新增</span>
        </span>
      ),
      content: (
        <div className={multiStyles.skillTagList}>
          {(node.skills || []).length === 0 ? (
            <span className={multiStyles.suggestionHint}>暂无技能</span>
          ) : (
            (node.skills || []).map((s, i) => (
              <span key={i} className={multiStyles.skillTag}>{s}</span>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'question',
      title: '用户问题建议',
      extra: (
        <span className={multiStyles.panelTitleDropdown}>
          <span>答案建议</span>
          <ChevronDown />
        </span>
      ),
      defaultOpen: true,
      content: (
        <div>
          <div className={multiStyles.suggestionHint}>
            在智能体回复后，自动根据对话内容提供建议问题，引导用户继续提问。
          </div>
          <div className={multiStyles.suggestionList}>
            {(node.suggestions || []).map((sug, i) => (
              <label key={i} className={multiStyles.suggestionItem}>
                <span className={`${multiStyles.suggestionCheck} ${multiStyles.suggestionCheckChecked}`}>
                  <CheckIcon />
                </span>
                <span>{sug}</span>
              </label>
            ))}
          </div>
        </div>
      ),
    },
  ]

  const headerInitial = node.label ? node.label.charAt(0) : 'A'

  return (
    <div
      ref={containerRef}
      className={getNodeClass(node)}
      style={{ left: node.x, top: node.y, width: node.width }}
      onMouseDown={(e) => onNodeMouseDown(e, node.id)}
    >
      <div className={`${multiStyles.agentCard} ${isSelected ? multiStyles.agentCardSelected : ''}`}>
        <div
          className={multiStyles.inputPort}
          style={{ position: 'absolute' }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => onPortMouseUp(e, node.id)}
        >
          <div className={multiStyles.portDot} />
        </div>

        <div className={multiStyles.cardHeader}>
          <div className={multiStyles.headerGradientIcon}>{headerInitial}</div>
          <div className={multiStyles.headerInfo}>
            <span className={multiStyles.headerName}>{node.label}</span>
            <span className={multiStyles.headerSub}>{node.subtitle}</span>
          </div>
          <div className={multiStyles.headerActions}>
            <button className={`${multiStyles.headerActionBtn} ${multiStyles.playBtn}`}>
              <PlayIcon />
            </button>
            <button className={multiStyles.headerActionBtn}>
              <MoreIcon />
            </button>
          </div>
        </div>

        <div className={multiStyles.panelList}>
          {panels.map((panel) => {
            const isOpen = panel.key in openPanels ? openPanels[panel.key] : panel.defaultOpen
            return (
              <div key={panel.key} className={multiStyles.panel}>
                <div
                  className={multiStyles.panelHeader}
                  onClick={(e) => { e.stopPropagation(); toggle(panel.key) }}
                >
                  <span className={`${multiStyles.panelArrow} ${isOpen ? multiStyles.panelArrowOpen : ''}`}>
                    <ArrowRight />
                  </span>
                  <span className={multiStyles.panelTitle}>{panel.title}</span>
                  {panel.extra}
                </div>
                {isOpen && (
                  <div className={multiStyles.panelContent}>{panel.content}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div
        className={`${multiStyles.portWrap} ${multiStyles.outputPort}`}
        onMouseDown={(e) => onPortMouseDown(e, node.id)}
      >
        <div className={`${multiStyles.portDot} ${connectingFromNodeId === node.id ? multiStyles.portDotActive : ''}`} />
      </div>
    </div>
  )
}

function StartNode({ node, isSelected, connectingFromNodeId, onNodeMouseDown, onPortMouseDown, getNodeClass }: NodeRendererProps) {
  return (
    <div
      className={getNodeClass(node)}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onMouseDown={(e) => onNodeMouseDown(e, node.id)}
    >
      <div className={`${multiStyles.startNode} ${isSelected ? multiStyles.startNodeSelected : ''}`}>
        <span className={multiStyles.startIcon}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5L12 7L3 12.5V1.5Z" />
          </svg>
        </span>
        <span>{node.label}</span>
      </div>
      <div
        className={`${multiStyles.portWrap} ${multiStyles.outputPort}`}
        onMouseDown={(e) => onPortMouseDown(e, node.id)}
      >
        <div className={`${multiStyles.portDot} ${connectingFromNodeId === node.id ? multiStyles.portDotActive : ''}`} />
      </div>
    </div>
  )
}

export function CanvasNodeRenderer(props: NodeRendererProps) {
  switch (props.node.type) {
    case 'start':
      return <StartNode {...props} />
    case 'agent':
    case 'subAgent':
      return <AgentNode {...props} />
  }
}
