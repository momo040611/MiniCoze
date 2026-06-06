import React, { useState, useRef, useCallback, useEffect } from 'react'
import styles from '../agent-detail/agent-detail.module.css'
import flowStyles from './SingleAgentFlow.module.css'
import plannerStyles from '../agent-planner/SingleAgentPlanner.module.css'
import type { AgentDetailData, FlowConfig, OpeningConfig } from '../agent-detail'
import type { ModelOption } from '../../../api/agent-config/model-options'
import { OpeningMessageEditor } from '../components/OpeningMessageEditor'
import { PreviewChat } from '../components/PreviewChat'
import { KnowledgeSelectModal } from '../components/KnowledgeSelectModal'
import { DatabaseTags } from '../components/DatabaseTags'
import { WorkflowSelectModal } from '../components/WorkflowSelectModal'
import { WorkflowTags } from '../components/WorkflowTags'
const MIN_LEFT_PCT = 30
const MAX_LEFT_PCT = 78
const DEFAULT_LEFT_PCT = 58

interface Props {
  agent: AgentDetailData
  persona: string
  model: string
  modelOptions: ModelOption[]
  onModelChange: (v: string) => void
  temperature: number
  contextLimit: number
  onTemperatureChange: (v: number) => void
  onContextLimitChange: (v: number) => void
  config: FlowConfig
  onConfigChange: (config: FlowConfig) => void
  openingConfig: OpeningConfig
  onOpeningChange: (config: OpeningConfig) => void
  isPublished: boolean
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
      <div className={`${styles.collapseContent} ${open ? styles.collapseContentOpen : ''}`}>{children}</div>
    </div>
  )
}

export function SingleAgentFlow({
  agent,
  persona,
  model,
  modelOptions,
  onModelChange,
  temperature,
  contextLimit,
  onTemperatureChange,
  onContextLimitChange,
  config,
  onConfigChange,
  openingConfig,
  onOpeningChange,
  isPublished,
}: Props) {
  const [leftPct, setLeftPct] = useState(DEFAULT_LEFT_PCT)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftPctRef = useRef(leftPct)
  const [modelOpen, setModelOpen] = useState(false)
  const [dialogFlow, setdialogFlow] = useState(false)
  const [dialogDatabase, setdialogDatabase] = useState(false)

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
            <WorkflowTags
              ids={config.workflows}
              onRemove={(id) => onConfigChange({ ...config, workflows: config.workflows.filter(w => w !== id) })}
              onAdd={() => setdialogFlow(true)}
            />
            <span className={styles.flowAddDesc}>添加对话流</span>
          </div>
          <span className={styles.flowAddDesc}>
              每次对话都会调用该对话流，用户"本轮对话输入"会作为对话流的输入参数"USER_INPUT"传入
            </span>
          <div style={{ marginTop: 20 }}>
            <CollapsePanel title="模型参数">
              <div className={plannerStyles.modelSelector}>
                <div
                  className={plannerStyles.modelTrigger}
                  onClick={() => setModelOpen((v) => !v)}
                >
                  <span className={plannerStyles.modelName}>{modelOptions.find(m => m.value === model)?.label ?? model}</span>
                  <span className={`${plannerStyles.modelArrow} ${modelOpen ? plannerStyles.modelArrowOpen : ''}`}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                {modelOpen && (
                  <div className={plannerStyles.modelDropdown}>
                    {modelOptions.map((m) => (
                      <button
                        key={m.value}
                        className={`${plannerStyles.modelOption} ${m.value === model ? plannerStyles.modelOptionActive : ''}`}
                        onClick={() => {
                          onModelChange(m.value)
                          setModelOpen(false)
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  
                  <button className={styles.addBtn}><span>+</span></button>
                </div>
              </div>
              <div className={styles.configRow}>
                <div className={styles.configRowInfo}>
                  <div className={styles.configRowText}>
                    <span className={styles.configRowName}>知识库</span>
                  </div>
                </div>
                <div className={styles.configRowRight}>
                  <DatabaseTags
                    ids={config.databases}
                    onRemove={(id) => onConfigChange({ ...config, databases: config.databases.filter(d => d !== id) })}
                    onAdd={() => setdialogDatabase(true)}
                  />
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
            isPublished={isPublished}
          />
          <WorkflowSelectModal
            visible={dialogFlow}
            onClose={() => setdialogFlow(false)}
            selectedIds={config.workflows}
            onRemove={(id) => onConfigChange({ ...config, workflows: config.workflows.filter(w => w !== id) })}
            onSelect={(wf) => {
              if (!config.workflows.includes(wf.id)) {
                onConfigChange({ ...config, workflows: [...config.workflows, wf.id] })
              }
            }}
          />
          <KnowledgeSelectModal
            visible={dialogDatabase}
            onClose={() => setdialogDatabase(false)}
            selectedIds={config.databases}
            onRemove={(id) => onConfigChange({ ...config, databases: config.databases.filter(d => d !== id) })}
            onSelect={(kb) => {
              if (!config.databases.includes(kb.id)) {
                onConfigChange({ ...config, databases: [...config.databases, kb.id] })
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
