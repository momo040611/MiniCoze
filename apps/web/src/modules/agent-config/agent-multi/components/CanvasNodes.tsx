import React from 'react'
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
  getNodeClass: (node: CanvasNode) => string
}

function StartNode({ node, isSelected, connectingFromNodeId, onNodeMouseDown, onPortMouseDown, getNodeClass }: NodeRendererProps) {
  return (
    <div
      className={getNodeClass(node)}
      style={{ left: node.x, top: node.y }}
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

function AgentNode({ node, isSelected, connectingFromNodeId, onNodeMouseDown, onPortMouseDown, onPortMouseUp, getNodeClass }: NodeRendererProps) {
  return (
    <div
      className={getNodeClass(node)}
      style={{ left: node.x, top: node.y }}
      onMouseDown={(e) => onNodeMouseDown(e, node.id)}
    >
      <div className={`${multiStyles.agentNode} ${isSelected ? multiStyles.agentNodeSelected : ''}`}>
        <div
          className={multiStyles.inputPort}
          style={{ position: 'absolute' }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => onPortMouseUp(e, node.id)}
        >
          <div className={multiStyles.portDot} />
        </div>
        {node.avatar ? (
          <img src={node.avatar} alt="" className={multiStyles.agentAvatar} />
        ) : (
          <div className={multiStyles.agentIconPlaceholder}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="6" width="12" height="8" rx="2" stroke="#506070" strokeWidth="1.2" />
              <circle cx="8" cy="4" r="2" stroke="#506070" strokeWidth="1.2" />
              <path d="M5 10L7 12L11 8" stroke="#506070" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <div className={multiStyles.agentInfo}>
          <span className={multiStyles.agentName}>{node.label}</span>
          <span className={multiStyles.agentRole}>{node.subtitle}</span>
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

function SubAgentNode({ node, isSelected, connectingFromNodeId, onNodeMouseDown, onPortMouseDown, onPortMouseUp, getNodeClass }: NodeRendererProps) {
  return (
    <div
      className={getNodeClass(node)}
      style={{ left: node.x, top: node.y }}
      onMouseDown={(e) => onNodeMouseDown(e, node.id)}
    >
      <div className={`${multiStyles.subAgentNode} ${isSelected ? multiStyles.subAgentNodeSelected : ''}`}>
        <div
          className={multiStyles.inputPort}
          style={{ position: 'absolute' }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => onPortMouseUp(e, node.id)}
        >
          <div className={multiStyles.portDot} />
        </div>
        <div className={multiStyles.subAgentIcon}>A</div>
        <div className={multiStyles.agentInfo}>
          <span className={multiStyles.agentName}>{node.label}</span>
          <span className={multiStyles.agentRole}>{node.subtitle}</span>
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

export function CanvasNodeRenderer(props: NodeRendererProps) {
  switch (props.node.type) {
    case 'start':
      return <StartNode {...props} />
    case 'agent':
      return <AgentNode {...props} />
    case 'subAgent':
      return <SubAgentNode {...props} />
  }
}