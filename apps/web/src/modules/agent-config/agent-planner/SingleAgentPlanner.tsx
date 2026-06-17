import React, { useState, useCallback } from 'react'
import styles from '../agent-detail/agent-detail.module.css'
import plannerStyles from './SingleAgentPlanner.module.css'
import type { AgentDetailData, PlannerConfig, OpeningConfig } from '../agent-detail'
import type { ModelOption } from '../../../api/agent-config/model-options'
import { OpeningMessageEditor } from '../components/OpeningMessageEditor'
import { PreviewChat } from '../components/PreviewChat'
import { KnowledgeSelectModal } from '../components/KnowledgeSelectModal'
import { DatabaseTags } from '../components/DatabaseTags'
import { WorkflowSelectModal } from '../components/WorkflowSelectModal'
import { WorkflowTags } from '../components/WorkflowTags'
import { AddPluginModal } from '../components/AddPluginModal'
import type { IPlugin } from '../../../api/plugins'

interface Props {
  agent: AgentDetailData
  persona: string
  setPersona: (v: string) => void
  model: string
  modelOptions: ModelOption[]
  onModelChange: (v: string) => void
  temperature: number
  onTemperatureChange: (v: number) => void
  contextLimit: number
  onContextLimitChange: (v: number) => void
  config: PlannerConfig
  onConfigChange: (config: PlannerConfig) => void
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

export function SingleAgentPlanner({
  agent,
  persona,
  setPersona,
  model,
  modelOptions,
  onModelChange,
  temperature,
  onTemperatureChange,
  contextLimit,
  onContextLimitChange,
  config,
  onConfigChange,
  openingConfig,
  onOpeningChange,
}: Props) {
  const [modelOpen, setModelOpen] = useState(false)
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false)
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false)
  const [pluginModalOpen, setPluginModalOpen] = useState(false)
  const { plugins, fileBoxEnabled, longMemoryEnabled, variables, databases } = config

  const updateConfig = useCallback(
    (patch: Partial<PlannerConfig>) => onConfigChange({ ...config, ...patch }),
    [config, onConfigChange],
  )
  return (
    <>
      <div className={styles.col} style={{ flex: '0 0 340px', minWidth: 280 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>人设与回复逻辑</h3>
        </div>
        <div className={styles.colBody}>
          <textarea
            className={styles.panelTextarea}
            placeholder={`例如：\n你是一个专业的客服助手，名叫${agent.name}。你需要：\n1. 始终保持礼貌和耐心\n2. 用简洁清晰的语言回复\n3. 遇到无法解决的问题时，引导用户提供更多信息`}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={20}
            style={{ height: '100%', minHeight: 300 }}
          />
          <span className={styles.charCount}>{persona.length} 字</span>
        </div>
      </div>

      <div className={styles.col} style={{ flex: '0 0 340px', minWidth: 280 }}>
        <div className={styles.colHeader}>
          <h3 className={styles.colTitle}>编排</h3>
        </div>
        <div className={styles.colBody}>
          <CollapsePanel title="模型设置">
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
                        updateConfig({ selectedModel: m.value })
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

          <CollapsePanel title="技能">
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>插件</span>
                  <span className={styles.configRowDesc}>添加 AI 能力插件</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                {plugins.length > 0 && (
                  <span className={styles.configRowCount}>{plugins.length} 个插件</span>
                )}
                <button className={styles.addBtn} onClick={() => setPluginModalOpen(true)}>
                  <span>+</span>
                </button>
              </div>
            </div>
            <div className={styles.configRow}>
            <div className={styles.configRowInfo}>
              <div className={styles.configRowText}>
                <span className={styles.configRowName}>工作流</span>
                <span className={styles.configRowDesc}>配置对话流程</span>
              </div>
            </div>
            <div className={styles.configRowRight}>
              <WorkflowTags
                ids={config.workflows}
                onRemove={(id) => updateConfig({ workflows: config.workflows.filter(w => w !== id) })}
                onAdd={() => setWorkflowModalOpen(true)}
              />
            </div>
          </div>
          </CollapsePanel>

          <CollapsePanel title="知识">
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>文本知识库</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                <button className={styles.addBtn} onClick={() => setKnowledgeModalOpen(true)}><span>+</span></button>
              </div>
            </div>
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>表格知识库</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                <button className={styles.addBtn} onClick={() => setKnowledgeModalOpen(true)}><span>+</span></button>
              </div>
            </div>
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>照片知识库</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                <button className={styles.addBtn} onClick={() => setKnowledgeModalOpen(true)}><span>+</span></button>
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
                <button className={styles.addBtn} ><span>+</span></button>
              </div>
            </div>
            <div className={styles.configRow}>
            <div className={styles.configRowInfo}>
              <div className={styles.configRowText}>
                <span className={styles.configRowName}>数据库</span>
              </div>
            </div>
            <div className={styles.configRowRight}>
              <DatabaseTags
                ids={databases}
                onRemove={(id) => updateConfig({ databases: databases.filter(d => d !== id) })}
                onAdd={() => setKnowledgeModalOpen(true)}
              />
            </div>
          </div>
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>长期记忆</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                <label className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={longMemoryEnabled}
                    onChange={(e) => updateConfig({ longMemoryEnabled: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            </div>
          </CollapsePanel>

          <CollapsePanel title="文件盒子">
            <div className={styles.configRow}>
              <div className={styles.configRowInfo}>
                <div className={styles.configRowText}>
                  <span className={styles.configRowName}>文件盒子</span>
                  <span className={styles.configRowDesc}>允许上传文件进行处理</span>
                </div>
              </div>
              <div className={styles.configRowRight}>
                <label className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={fileBoxEnabled}
                    onChange={(e) => updateConfig({ fileBoxEnabled: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </label>
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

      <div className={styles.col} style={{ flex: 1, minWidth: 320 }}>
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
            knowledgeBaseId={databases[0]}
          />
        </div>
      </div>
      <WorkflowSelectModal
        visible={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        selectedIds={config.workflows}
        onRemove={(id) => updateConfig({ workflows: config.workflows.filter(w => w !== id) })}
        onSelect={(wf) => {
          if (!config.workflows.includes(wf.id)) {
            updateConfig({ workflows: [...config.workflows, wf.id] })
          }
        }}
      />
      <AddPluginModal
        visible={pluginModalOpen}
        onClose={() => setPluginModalOpen(false)}
        selectedIds={config.plugins}
        onSelect={(selectedPlugins: IPlugin[]) => {
          updateConfig({ plugins: selectedPlugins.map((p) => p.id) })
        }}
      />
      <KnowledgeSelectModal
        visible={knowledgeModalOpen}
        onClose={() => setKnowledgeModalOpen(false)}
        selectedIds={config.databases}
        onRemove={(id) => updateConfig({ databases: config.databases.filter(d => d !== id) })}
        onSelect={(kb) => {
          if (!config.databases.includes(kb.id)) {
            onConfigChange({ ...config, databases: [...config.databases, kb.id] })
          }
        }}
      />
    </>
  )
}
