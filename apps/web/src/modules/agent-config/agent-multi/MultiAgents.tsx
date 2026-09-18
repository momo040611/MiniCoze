import React, { useCallback, useState } from 'react'
import { FreeLayoutEditorProvider } from '@flowgram.ai/free-layout-editor'
import '@flowgram.ai/free-layout-editor/index.css'
import styles from '../agent-detail/agent-detail.module.css'
import plannerStyles from '../agent-planner/SingleAgentPlanner.module.css'
import type { AgentDetailData, MultiConfig, MultiGraph, OpeningConfig } from '../agent-detail'
import type { ModelOption } from '../../../api/agent-config/model-options'
import { OpeningMessageEditor } from '../components/OpeningMessageEditor'
import { PreviewChat } from '../components/PreviewChat'
import { KnowledgeSelectModal } from '../components/KnowledgeSelectModal'
import { DatabaseTags } from '../components/DatabaseTags'
import { WorkflowSelectModal } from '../components/WorkflowSelectModal'
import { WorkflowTags } from '../components/WorkflowTags'
import { AddPluginModal } from '../components/AddPluginModal'
import type { IPlugin } from '../../../api/plugins'
import { MultiCanvas } from './components/MultiCanvas'
import { useMultiEditorProps } from './hooks/useMultiEditorProps'

interface Props {
  agent: AgentDetailData
  persona: string
  setPersona: (v: string) => void
  model: string
  modelOptions: ModelOption[]
  onModelChange: (v: string) => void
  temperature: number
  contextLimit: number
  onTemperatureChange: (v: number) => void
  onContextLimitChange: (v: number) => void
  config: MultiConfig
  onConfigChange: (config: MultiConfig) => void
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
      <div className={`${styles.collapseContent} ${open ? styles.collapseContentOpen : ''}`}>{children}</div>
    </div>
  )
}

function ConfigPanel({
  persona, setPersona,
  model, modelOptions, onModelChange, modelOpen, setModelOpen,
  temperature, contextLimit,
  onTemperatureChange, onContextLimitChange,
  config, onConfigChange,
  openingConfig, onOpeningChange,
  agent, setDialogFlow, setDatabase,
  setPluginModalOpen,
}: {
  persona: string; setPersona: (v: string) => void
  model: string; modelOptions: ModelOption[]; onModelChange: (v: string) => void
  modelOpen: boolean; setModelOpen: (v: boolean) => void
  temperature: number; contextLimit: number
  onTemperatureChange: (v: number) => void; onContextLimitChange: (v: number) => void
  config: MultiConfig; onConfigChange: (config: MultiConfig) => void
  openingConfig: OpeningConfig; onOpeningChange: (config: OpeningConfig) => void
  agent: AgentDetailData
  setDialogFlow: (v: boolean) => void; setDatabase: (v: boolean) => void
  setPluginModalOpen: (v: boolean) => void
}) {
  return (
    <div className={styles.col} style={{ flex: '0 0 320px', minWidth: 280 }}>
      <div className={styles.colHeader}>
        <h3 className={styles.colTitle}>编排</h3>
      </div>
      <div className={styles.colBody}>
        <CollapsePanel title="人设与回复逻辑">
          <textarea
            className={styles.panelTextarea}
            placeholder="定义主 Agent 的基础人设，例如：\n你是一个协调者，负责将任务分发给合适的子 Agent..."
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={6}
          />
          <span className={styles.charCount}>{persona.length} 字</span>
        </CollapsePanel>

        <CollapsePanel title="模型参数">
          <div className={plannerStyles.modelSelector}>
            <div
              className={plannerStyles.modelTrigger}
              onClick={() => setModelOpen(!modelOpen)}
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
                <input className={styles.paramRange} type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => onTemperatureChange(Number(e.target.value))} />
                <input className={styles.paramNumber} type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => { const next = Math.min(2, Math.max(0, Number(e.target.value) || 0)); onTemperatureChange(Number(next.toFixed(1))) }} />
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
                <select className={styles.paramSelect} value={contextLimit} onChange={(e) => onContextLimitChange(Number(e.target.value))}>
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

        <CollapsePanel title="技能">
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}>
              <div className={styles.configRowText}>
                <span className={styles.configRowName}>插件</span>
                <span className={styles.configRowDesc}>添加 AI 能力插件</span>
              </div>
            </div>
            <div className={styles.configRowRight}>
              {config.plugins.length > 0 && (
                <span className={styles.configRowCount}>{config.plugins.length} 个插件</span>
              )}
              <button className={styles.addBtn} onClick={() => setPluginModalOpen(true)}>
                <span>+</span>
              </button>
            </div>
          </div>
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}><div className={styles.configRowText}><span className={styles.configRowName}>工作流</span></div></div>
            <div className={styles.configRowRight}>
              <WorkflowTags
                ids={config.workflows}
                onRemove={(id) => onConfigChange({ ...config, workflows: config.workflows.filter(w => w !== id) })}
                onAdd={() => setDialogFlow(true)}
              />
            </div>
          </div>
        </CollapsePanel>

        <CollapsePanel title="触发器">
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}>
              <div className={styles.configRowText}>
                <span className={styles.configRowName}>触发器配置</span>
                <span className={styles.configRowDesc}>设置多 Agent 协作触发条件</span>
              </div>
            </div>
            <div className={styles.configRowRight}><button className={styles.addBtn}><span>+</span></button></div>
          </div>
        </CollapsePanel>

        <CollapsePanel title="记忆">
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}><div className={styles.configRowText}><span className={styles.configRowName}>变量</span></div></div>
            <div className={styles.configRowRight}><button className={styles.addBtn}><span>+</span></button></div>
          </div>
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}><div className={styles.configRowText}><span className={styles.configRowName}>知识库</span></div></div>
            <div className={styles.configRowRight}>
              <DatabaseTags
                ids={config.databases}
                onRemove={(id) => onConfigChange({ ...config, databases: config.databases.filter(d => d !== id) })}
                onAdd={() => setDatabase(true)}
              />
            </div>
          </div>
          <div className={styles.configRow}>
            <div className={styles.configRowInfo}><div className={styles.configRowText}><span className={styles.configRowName}>长期记忆</span></div></div>
            <div className={styles.configRowRight}>
              <label className={styles.toggleSwitch}>
                <input type="checkbox" checked={config.longMemoryEnabled} onChange={(e) => onConfigChange({ ...config, longMemoryEnabled: e.target.checked })} />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          </div>
        </CollapsePanel>

        <CollapsePanel title="对话体验">
          <OpeningMessageEditor agentName={agent.name} config={openingConfig} onChange={onOpeningChange} defaultOpen={!!openingConfig.openingMessage} />
        </CollapsePanel>
      </div>
    </div>
  )
}

export function MultiAgents({
  agent, persona, setPersona,
  model, modelOptions, onModelChange, temperature, contextLimit,
  onTemperatureChange, onContextLimitChange,
  config, onConfigChange,
  openingConfig, onOpeningChange,
}: Props) {
  const [database, setDatabase] = useState(false)
  const [dialogFlow, setDialogFlow] = useState(false)
  const [pluginModalOpen, setPluginModalOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)

  const handleGraphChange = useCallback(
    (graph: MultiGraph) => onConfigChange({ ...config, graph }),
    [config, onConfigChange],
  )

  const editorProps = useMultiEditorProps({
    agent,
    graph: config.graph,
    modelOptions,
    onGraphChange: handleGraphChange,
  })

  return (
    <>
      <ConfigPanel
        persona={persona} setPersona={setPersona}
        model={model} modelOptions={modelOptions} onModelChange={onModelChange} modelOpen={modelOpen} setModelOpen={setModelOpen}
        temperature={temperature} contextLimit={contextLimit}
        onTemperatureChange={onTemperatureChange} onContextLimitChange={onContextLimitChange}
        config={config} onConfigChange={onConfigChange}
        openingConfig={openingConfig} onOpeningChange={onOpeningChange}
        agent={agent}
        setDialogFlow={setDialogFlow} setDatabase={setDatabase}
        setPluginModalOpen={setPluginModalOpen}
      />

      <div className={styles.col} style={{ flex: 1, minWidth: 400 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>编排画布</h3>
        </div>
        <div className={styles.colBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <FreeLayoutEditorProvider key={agent.id} {...editorProps}>
            <MultiCanvas agentName={agent.name} />
          </FreeLayoutEditorProvider>
        </div>
      </div>

      <div className={styles.col} style={{ flex: '0 0 360px', minWidth: 320 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>预览与调试</h3>
        </div>
        <div className={styles.colBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <PreviewChat
            agentId={agent.id}
            agentName={agent.name}
            avatar={agent.avatar}
            persona={persona}
            model={model}
            temperature={temperature}
            openingConfig={openingConfig}
            knowledgeBaseId={config.databases[0]}
          />
          <WorkflowSelectModal
            visible={dialogFlow}
            onClose={() => setDialogFlow(false)}
            selectedIds={config.workflows}
            onRemove={(id) => onConfigChange({ ...config, workflows: config.workflows.filter(w => w !== id) })}
            onSelect={(wf) => {
              if (!config.workflows.includes(wf.id)) {
                onConfigChange({ ...config, workflows: [...config.workflows, wf.id] })
              }
            }}
          />
          <KnowledgeSelectModal
            visible={database}
            onClose={() => setDatabase(false)}
            selectedIds={config.databases}
            onRemove={(id) => onConfigChange({ ...config, databases: config.databases.filter(d => d !== id) })}
            onSelect={(kb) => {
              if (!config.databases.includes(kb.id)) {
                onConfigChange({ ...config, databases: [...config.databases, kb.id] })
              }
            }}
          />
          <AddPluginModal
            visible={pluginModalOpen}
            onClose={() => setPluginModalOpen(false)}
            selectedIds={config.plugins}
            onSelect={(selectedPlugins: IPlugin[]) => {
              onConfigChange({ ...config, plugins: selectedPlugins.map((p) => p.id) })
            }}
          />
        </div>
      </div>
    </>
  )
}