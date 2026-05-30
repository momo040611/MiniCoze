import React, { useState, useRef, useCallback, useEffect } from 'react'
import styles from '../agent-detail/agent-detail.module.css'
import flowStyles from './SingleAgentFlow.module.css'
import type { AgentDetailData, FlowConfig, OpeningConfig } from '../agent-detail'
import { OpeningMessageEditor } from '../components/OpeningMessageEditor'
import { PreviewChat } from '../components/PreviewChat'

const MIN_LEFT_PCT = 30
const MAX_LEFT_PCT = 78
const DEFAULT_LEFT_PCT = 58

interface Props {
  agent: AgentDetailData
  persona: string
  model: string
  temperature: number
  contextLimit: number
  onTemperatureChange: (v: number) => void
  onContextLimitChange: (v: number) => void
  config: FlowConfig
  onConfigChange: (config: FlowConfig) => void
  openingConfig: OpeningConfig
  onOpeningChange: (config: OpeningConfig) => void
}

function CollapsePanel({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.collapsePanel}>
      <div className={styles.collapseHeader} onClick={() => setOpen(!open)}>
        <span className={styles.collapseTitle}>{title}</span>
        <span className={`${styles.collapseArrow} ${open ? styles.collapseArrowOpen : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {open && <div className={styles.collapseContent}>{children}</div>}
    </div>
  )
}

const NODE_TYPES = [
  { key: 'start', label: '开始节点', icon: '▶' },
  { key: 'condition', label: '条件节点', icon: '◇' },
  { key: 'reply', label: '回复节点', icon: '💬' },
  { key: 'api', label: 'API 节点', icon: '🔌' },
  { key: 'end', label: '结束节点', icon: '⏹' },
] as const

export function SingleAgentFlow({
  agent,
  persona,
  model,
  temperature,
  contextLimit,
  onTemperatureChange,
  onContextLimitChange,
  config,
  onConfigChange,
  openingConfig,
  onOpeningChange,
}: Props) {
  const { nodes, variables, databases } = config
  const [leftPct, setLeftPct] = useState(DEFAULT_LEFT_PCT)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftPctRef = useRef(leftPct)

  useEffect(() => {
    leftPctRef.current = leftPct
  }, [leftPct])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = (x / rect.width) * 100
      const clamped = Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, pct))
      leftPctRef.current = clamped
      setLeftPct(clamped)
    },
    [],
  )

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!dragging) return
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  const handleAddNode = (nodeType: (typeof NODE_TYPES)[number]) => {
    const newNode = {
      id: `${nodeType.key}-${Date.now()}`,
      type: nodeType.key,
      x: 200 + nodes.length * 40,
      y: 200 + nodes.length * 40,
    }
    onConfigChange({ ...config, nodes: [...nodes, newNode] })
  }

  const handleAddVariable = () => {
    onConfigChange({ ...config, variables: [...variables, `变量 ${variables.length + 1}`] })
  }

  const handleAddDatabase = () => {
    onConfigChange({ ...config, databases: [...databases, `数据库 ${databases.length + 1}`] })
  }

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}
    >
      <div className={styles.col} style={{ width: `${leftPct}%`, minWidth: 320, flexShrink: 0 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>编排</h3>
        </div>
        <div className={styles.colBody}>
          <div className={flowStyles.flowAddArea}>
            <div className={flowStyles.flowAddIcon}>+</div>
            <span className={flowStyles.flowAddText}>点击添加对话流</span>
            <span className={flowStyles.flowAddDesc}>
              每次对话都会调用该对话流，用户"本轮对话输入"会作为对话流的输入参数"USER_INPUT"传入
            </span>
          </div>

          <div style={{
            display: 'flex',
            gap: 8,
            padding: '8px 0',
            flexWrap: 'wrap',
            marginBottom: 16,
          }}>
            {NODE_TYPES.map((node) => (
              <button
                key={node.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  border: '1px solid rgba(104,119,144,0.15)',
                  borderRadius: 6,
                  background: '#fff',
                  color: '#506070',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                onClick={() => handleAddNode(node)}
              >
                <span>{node.icon}</span>
                <span>{node.label}</span>
              </button>
            ))}
          </div>

          <div style={{
            border: '1px solid rgba(104,119,144,0.15)',
            borderRadius: 8,
            minHeight: 300,
            backgroundImage:
              'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {nodes.length === 0 && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                color: '#a0aec0',
                fontSize: 13,
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '2px dashed #d0d5dd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}>+</div>
                <span>从上方工具栏添加节点</span>
              </div>
            )}
            {nodes.map((node) => (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  background: '#fff',
                  border: '1px solid rgba(104,119,144,0.2)',
                  borderRadius: 6,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#18202f',
                  cursor: 'pointer',
                }}
              >
                <span>{NODE_TYPES.find((n) => n.key === node.type)?.icon}</span>
                <span>{NODE_TYPES.find((n) => n.key === node.type)?.label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <CollapsePanel title="模型参数">
              <div className={styles.configRow}>
                <div className={styles.configRowInfo}>
                  <div className={styles.configRowText}>
                    <span className={styles.configRowName}>Temperature</span>
                    <span className={styles.configRowDesc}>控制回复随机性，数值越高越发散</span>
                  </div>
                </div>
                <div className={styles.configRowRight}>
                  <div className={styles.paramControl}>
                  <input
                    className={styles.paramRange}
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(event) => onTemperatureChange(Number(event.target.value))}
                  />
                  <input
                    className={styles.paramNumber}
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(event) => {
                      const next = Math.min(2, Math.max(0, Number(event.target.value) || 0))
                      onTemperatureChange(Number(next.toFixed(1)))
                    }}
                  />
                  </div>
                </div>
              </div>
              <div className={styles.configRow}>
                <div className={styles.configRowInfo}>
                  <div className={styles.configRowText}>
                    <span className={styles.configRowName}>上下文轮数</span>
                    <span className={styles.configRowDesc}>控制运行时携带的历史消息数量</span>
                  </div>
                </div>
                <div className={styles.configRowRight}>
                  <div className={styles.paramControl}>
                  <select
                    className={styles.paramSelect}
                    value={contextLimit}
                    onChange={(event) => onContextLimitChange(Number(event.target.value))}
                  >
                    <option value={0}>不携带</option>
                    <option value={5}>5 条</option>
                    <option value={10}>10 条</option>
                    <option value={20}>20 条</option>
                    <option value={50}>50 条</option>
                    <option value={100}>100 条</option>
                  </select>
                  </div>
                </div>
              </div>
            </CollapsePanel>

            <CollapsePanel title="记忆">
              <div className={styles.configRow}>
                <div className={styles.configRowInfo}>
                  <div className={styles.configRowText}>
                    <span className={styles.configRowName}>变量</span>
                  </div>
                </div>
                <div className={styles.configRowRight}>
                  {variables.length > 0 && (
                    <span className={styles.configRowCount}>{variables.length} 个变量</span>
                  )}
                  <button className={styles.addBtn} onClick={handleAddVariable}><span>+</span></button>
                </div>
              </div>
              <div className={styles.configRow}>
                <div className={styles.configRowInfo}>
                  <div className={styles.configRowText}>
                    <span className={styles.configRowName}>数据库</span>
                  </div>
                </div>
                <div className={styles.configRowRight}>
                  {databases.length > 0 && (
                    <span className={styles.configRowCount}>{databases.length} 个数据库</span>
                  )}
                  <button className={styles.addBtn} onClick={handleAddDatabase}><span>+</span></button>
                </div>
              </div>
            </CollapsePanel>

            <CollapsePanel title="对话体验">
              <OpeningMessageEditor
                agentName={agent.name}
                config={openingConfig}
                onChange={onOpeningChange}
                defaultOpen={!!openingConfig.openingMessage}
              />
            </CollapsePanel>
          </div>
        </div>
      </div>

      <div
        className={flowStyles.splitter}
        onMouseDown={handleMouseDown}
      >
        <div className={flowStyles.splitterLine} />
      </div>

      <div className={styles.col} style={{ flex: 1, minWidth: 260, overflow: 'hidden' }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>预览与调试</h3>
        </div>
        <div className={styles.colBody} style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PreviewChat
            agentId={agent.id}
            agentName={agent.name}
            avatar={agent.avatar}
            persona={persona}
            model={model}
            temperature={temperature}
            openingConfig={openingConfig}
          />
        </div>
      </div>
    </div>
  )
}
