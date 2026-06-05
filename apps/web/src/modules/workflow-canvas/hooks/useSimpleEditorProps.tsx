import { useMemo, useRef } from 'react'
import {
    WorkflowNodeRenderer,
    useNodeRender,
} from '@flowgram.ai/free-layout-editor'
import type {
    WorkflowNodeProps,
    FreeLayoutProps,
    WorkflowJSON,
    WorkflowNodeRegistry,
    WorkflowNodeEntity,
} from '@flowgram.ai/free-layout-editor'

import styles from './useSimpleEditorProps.module.css'

import {
    renderStartNode,
    renderEndNode,
    renderLLMNode,
    renderInputNode,
    renderOutputNode,
    renderConditionNode,
    renderPluginNode,
    renderDatabaseNode,
    renderGenericNode,
} from '../nodeRenders'

import {
    DEFAULT_WORKFLOW_CANVAS_DATA,
    saveWorkflowDraftRemote,
    type WorkflowCanvasData,
} from '../../../api/workflows'
import type { NodeValidationError } from '../utils/validateWorkflow'

// 节点注册配置
const nodeRegistries: WorkflowNodeRegistry[] = [
    {
        type: 'start',
        meta: {
            isStart: true,
            deleteDisable: true,
            copyDisable: true,
            defaultPorts: [{ type: 'output' }],
        },
    },
    {
        type: 'llm',
        meta: {
            defaultPorts: [{ type: 'input' }, { type: 'output' }],
        },
    },
    {
        type: 'condition',
        meta: {
            defaultPorts: [{ type: 'input' }, { type: 'output' }],
        },
    },
    {
        type: 'plugin',
        meta: {
            defaultPorts: [{ type: 'input' }, { type: 'output' }],
        },
    },
    {
        type: 'database',
        meta: {
            defaultPorts: [{ type: 'input' }, { type: 'output' }],
        },
    },
    {
        type: 'end',
        meta: {
            deleteDisable: true,
            copyDisable: true,
            defaultPorts: [{ type: 'input' }],
        },
    },
    {
        type: 'input',
        meta: {
            defaultPorts: [{ type: 'input' }],
        },
    },
    {
        type: 'output',
        meta: {
            defaultPorts: [{ type: 'output' }],
        },
    },
]

type UseSimpleEditorPropsParams = {
    workflowId?: string
    canvasData?: WorkflowCanvasData
    onSelectNode?: (node: WorkflowNodeEntity) => void
    onCanvasChange?: (canvasData: WorkflowCanvasData) => void
    validationErrorsByNodeId?: Record<string, NodeValidationError[]>
}

export const useSimpleEditorProps = ({
    workflowId,
    canvasData,
    onSelectNode,
    onCanvasChange,
    validationErrorsByNodeId,
}: UseSimpleEditorPropsParams) => {
    const saveTimerRef = useRef<number | null>(null)

    return useMemo<FreeLayoutProps>(
        () => ({
            background: false,
            readonly: false,

            initialData:
                canvasData && canvasData.nodes.length > 0
                    ? (canvasData as WorkflowJSON)
                    : (DEFAULT_WORKFLOW_CANVAS_DATA as WorkflowJSON),

            nodeRegistries,

            getNodeDefaultRegistry(type) {
                return {
                    type,
                    formMeta: {
                        render: () => {
                            if (type === 'llm') {
                                return renderLLMNode()
                            }

                            if (type === 'start') {
                                return renderStartNode()
                            }

                            if (type === 'end') {
                                return renderEndNode()
                            }

                            if (type === 'condition' || type === 'selector') {
                                return renderConditionNode()
                            }

                            if (type === 'plugin') {
                                return renderPluginNode()
                            }

                            if (type === 'database') {
                                return renderDatabaseNode()
                            }

                            if (type === 'input') {
                                return renderInputNode()
                            }

                            if (type === 'output') {
                                return renderOutputNode()
                            }

                            return renderGenericNode()
                        },
                    },
                }
            },

            materials: {
                renderDefaultNode: (props: WorkflowNodeProps) => {
                    const { form } = useNodeRender()
                    const nodeJson = props.node.toJSON?.() as { id?: string } | undefined
                    const nodeId = nodeJson?.id ?? String((props.node as unknown as { id?: string }).id ?? '')
                    const nodeErrors = nodeId ? validationErrorsByNodeId?.[nodeId] : undefined
                    const hasError = Boolean(nodeErrors?.length)

                    return (
                        <div
                            onClick={(event) => {
                                event.stopPropagation()
                                onSelectNode?.(props.node)
                            }}
                            className={styles.nodeShell}
                        >
                            <WorkflowNodeRenderer
                                node={props.node}
                                className={`${styles.workflowNode} ${hasError ? styles.workflowNodeError : ''}`}
                            >
                                {hasError && (
                                    <div className={styles.errorBadge} title={nodeErrors?.map((item) => item.message).join('\n')}>
                                        !
                                    </div>
                                )}
                                {form?.render()}
                            </WorkflowNodeRenderer>
                        </div>
                    )
                },
            },

            nodeEngine: {
                enable: true,
            },

            history: {
                enable: true,
                enableChangeNode: true,
            },

            onContentChange(ctx) {
                const nextCanvasData = ctx.document.toJSON() as WorkflowCanvasData
                onCanvasChange?.(nextCanvasData)

                if (!workflowId) {
                    return
                }

                if (saveTimerRef.current) {
                    window.clearTimeout(saveTimerRef.current)
                }

                saveTimerRef.current = window.setTimeout(() => {
                    saveWorkflowDraftRemote(workflowId, nextCanvasData).catch((error) => {
                        console.error(error)
                    })

                    console.log('画布已自动保存：', nextCanvasData)
                }, 500)
            },
        }),
        [workflowId, canvasData, onSelectNode, onCanvasChange, validationErrorsByNodeId],
    )
}
