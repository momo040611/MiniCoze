import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
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
    renderLoopNode,
    renderPluginNode,
    renderDatabaseNode,
    renderAnnotationNode,
    renderGenericNode,
} from '../nodeRenders'

import {
    DEFAULT_WORKFLOW_CANVAS_DATA,
    normalizeWorkflowCanvasData,
    saveWorkflowDraftRemote,
    type WorkflowCanvasData,
} from '../../../api/workflows'
import type { NodeValidationError } from '../utils/validateWorkflow'

let validationErrorSnapshot: Record<string, NodeValidationError[]> = {}
const validationErrorListeners = new Set<() => void>()

function setValidationErrorSnapshot(nextSnapshot: Record<string, NodeValidationError[]> = {}) {
    validationErrorSnapshot = nextSnapshot
    validationErrorListeners.forEach((listener) => listener())
}

function subscribeValidationErrors(listener: () => void) {
    validationErrorListeners.add(listener)
    return () => {
        validationErrorListeners.delete(listener)
    }
}

function getValidationErrorSnapshot() {
    return validationErrorSnapshot
}

function ErrorAwareNodeRenderer({
    node,
    onSelectNode,
}: {
    node: WorkflowNodeEntity
    onSelectNode?: (node: WorkflowNodeEntity) => void
}) {
    const { form } = useNodeRender()
    const errorsByNodeId = useSyncExternalStore(
        subscribeValidationErrors,
        getValidationErrorSnapshot,
        getValidationErrorSnapshot,
    )
    const nodeJson = node.toJSON?.() as { id?: string } | undefined
    const nodeId = nodeJson?.id ?? String((node as unknown as { id?: string }).id ?? '')
    const nodeErrors = nodeId ? errorsByNodeId[nodeId] : undefined
    const hasError = Boolean(nodeErrors?.length)
    const isAnnotation = String(node.flowNodeType ?? '') === 'annotation'

    if (isAnnotation) {
        return (
            <WorkflowNodeRenderer
                node={node}
                className={styles.annotationWorkflowNode}
            >
                {form?.render()}
            </WorkflowNodeRenderer>
        )
    }

    return (
        <div
            onClick={(event) => {
                event.stopPropagation()
                onSelectNode?.(node)
            }}
            className={styles.nodeShell}
        >
            <WorkflowNodeRenderer
                node={node}
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
}

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
        type: 'loop',
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
    {
        type: 'annotation',
        meta: {
            defaultPorts: [],
        },
    },
]

type UseSimpleEditorPropsParams = {
    workflowId?: string
    canvasData?: WorkflowCanvasData
    onSelectNode?: (node: WorkflowNodeEntity) => void
    onCanvasChange?: (canvasData: WorkflowCanvasData) => void
    onDirty?: () => void
    onSaveStart?: () => void
    onSaveSuccess?: (workflow: Awaited<ReturnType<typeof saveWorkflowDraftRemote>>) => void
    onSaveError?: (error: unknown) => void
    validationErrorsByNodeId?: Record<string, NodeValidationError[]>
}

export const useSimpleEditorProps = ({
    workflowId,
    canvasData,
    onSelectNode,
    onCanvasChange,
    onDirty,
    onSaveStart,
    onSaveSuccess,
    onSaveError,
    validationErrorsByNodeId,
}: UseSimpleEditorPropsParams) => {
    const saveTimerRef = useRef<number | null>(null)
    const safeCanvasData = useMemo(
        () => normalizeWorkflowCanvasData(canvasData),
        [canvasData],
    )

    useEffect(() => {
        setValidationErrorSnapshot(validationErrorsByNodeId)
    }, [validationErrorsByNodeId])

    useEffect(() => () => {
        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current)
        }
        setValidationErrorSnapshot({})
    }, [])

    return useMemo<FreeLayoutProps>(
        () => ({
            background: false,
            readonly: false,

            initialData:
                safeCanvasData.nodes.length > 0
                    ? (safeCanvasData as WorkflowJSON)
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

                            if (type === 'loop') {
                                return renderLoopNode()
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

                            if (type === 'annotation') {
                                return renderAnnotationNode()
                            }

                            return renderGenericNode()
                        },
                    },
                }
            },

            materials: {
                renderDefaultNode: (props: WorkflowNodeProps) => {
                    return <ErrorAwareNodeRenderer node={props.node} onSelectNode={onSelectNode} />
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
                onDirty?.()

                if (!workflowId) {
                    return
                }

                if (saveTimerRef.current) {
                    window.clearTimeout(saveTimerRef.current)
                }

                saveTimerRef.current = window.setTimeout(() => {
                    onSaveStart?.()
                    saveWorkflowDraftRemote(workflowId, nextCanvasData)
                        .then((savedWorkflow) => {
                            onSaveSuccess?.(savedWorkflow)
                        })
                        .catch((error) => {
                            onSaveError?.(error)
                        })
                }, 500)
            },
        }),
        [
            workflowId,
            safeCanvasData,
            onSelectNode,
            onCanvasChange,
            onDirty,
            onSaveStart,
            onSaveSuccess,
            onSaveError,
        ],
    )
}
