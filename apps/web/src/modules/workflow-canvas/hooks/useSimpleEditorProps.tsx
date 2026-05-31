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
} from '../nodeRenders'

import {
    DEFAULT_WORKFLOW_CANVAS_DATA,
    updateWorkflow,
    type WorkflowCanvasData,
} from '../../../api/workflows'

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
}

export const useSimpleEditorProps = ({
    workflowId,
    canvasData,
    onSelectNode,
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

                            if (type === 'input') {
                                return renderInputNode()
                            }

                            if (type === 'output') {
                                return renderOutputNode()
                            }

                            return null
                        },
                    },
                }
            },

            materials: {
                renderDefaultNode: (props: WorkflowNodeProps) => {
                    const { form } = useNodeRender()

                    return (
                        <div
                            onClick={(event) => {
                                event.stopPropagation()
                                onSelectNode?.(props.node)
                            }}
                        >
                            <WorkflowNodeRenderer
                                node={props.node}
                                className={styles.workflowNode}
                            >
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

                if (!workflowId) {
                    return
                }

                if (saveTimerRef.current) {
                    window.clearTimeout(saveTimerRef.current)
                }

                saveTimerRef.current = window.setTimeout(() => {
                    updateWorkflow(workflowId, {
                        canvasData: nextCanvasData,
                    })

                    console.log('画布已自动保存：', nextCanvasData)
                }, 500)
            },
        }),
        [workflowId, canvasData, onSelectNode],
    )
}