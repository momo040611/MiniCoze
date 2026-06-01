import { useMemo } from 'react'
import { Field, WorkflowNodeRenderer, useNodeRender } from '@flowgram.ai/free-layout-editor'
import type { WorkflowNodeProps, FreeLayoutProps, WorkflowJSON, WorkflowNodeRegistry } from '@flowgram.ai/free-layout-editor'
import styles from './useSimpleEditorProps.module.css'
const initialData: WorkflowJSON = {
    nodes: [
        {
            id: 'start_1',
            type: 'start',
            meta: {
                position: { x: 120, y: 230 }
            },
            data: {
                title: '开始节点',
                inputLabel: '输入',
                inputType: 'str',
                inputName: '待定'
            }
        },
        {
            id: 'llm_1',
            type: 'llm',
            meta: {
                position: { x: 300, y: 230 }
            },
            data: {
                title: '大模型节点',
                model: 'deepseek',
                prompt: '你是智能助手'
            }
        },
        {
            id: 'end_1',
            type: 'end',
            meta: {
                position: { x: 500, y: 230 }
            },
            data: {
                title: '结束节点',
                outputLabel: '输出',
                outputType: 'str',
                outputName: '待定',
                outputModeLabel: '输出类型',
                outputMode: '返回变量',
            }
        }
    ],
    edges: []
}
// 画布初始数据
const nodeRegistries: WorkflowNodeRegistry[] = [
    {
        type: 'start',
        meta: {
            isStart: true,
            deleteDisable: true,
            copyDisable: true,
            defaultPorts: [{ type: 'output' }]
        }
    },
    {
        type: 'llm',
        meta: {
            defaultPorts: [
                { type: 'input' },
                { type: 'output' }]
        }
    },
    {
        type: 'end',
        meta: {
            deleteDisable: true,
            copyDiable: true,
            defaultPorts: [{ type: 'input' }]
        }
    }
]//对于不同的节点的处理情况
const renderInputNode = () =>
(
    <div className={styles.inputNode}>
        <Field<string> name='title'>
            {({ field }) => (
                <div className={styles.workflowNodeTitle}>
                    {field.value}
                </div>
            )}
        </Field>
        <div className={styles.inputRow}>
            <Field<string> name='inputLabel'>
                {({ field }) => (
                    <span>
                        {field.value}
                    </span>
                )}
            </Field>
            <div className={styles.inputValueBox}>
                <Field<string> name='inputType'>
                    {({ field }) => (
                        <span className={styles.inputType}>
                            {field.value}
                        </span>
                    )}
                </Field>
                <Field<string> name='inputName'>
                    {({ field }) => (
                        <span className={styles.inputName}>
                            {field.value}
                        </span>
                    )}
                </Field>
            </div>
        </div >
    </div>
)

const renderLLMNode = () => (
    <div className={styles.llmNode}>
        {renderInputNode()}
        <Field<string> name="model">
            {({ field }) => (
                <div className={styles.workflowNodeDesc}>
                    模型：{field.value}
                </div>
            )}
        </Field>
    </div>
)
const renderOutputNode = () => (
    <div className={styles.outputNode}>
        <Field<string> name="title">
            {({ field }) => (
                <div className={styles.outputTitle}>
                    {field.value}
                </div>
            )}
        </Field>

        <div className={styles.outputContent}>
            <div className={styles.outputRow}>
                <Field<string> name="outputLabel">
                    {({ field }) => (
                        <span className={styles.outputLabel}>
                            {field.value}
                        </span>
                    )}
                </Field>

                <div className={styles.outputTag}>
                    <Field<string> name="outputType">
                        {({ field }) => (
                            <span className={styles.outputType}>
                                {field.value}
                            </span>
                        )}
                    </Field>

                    <span className={styles.dot}>.</span>

                    <Field<string> name="outputName">
                        {({ field }) => (
                            <span className={styles.outputName}>
                                {field.value}
                            </span>
                        )}
                    </Field>
                </div>
            </div>

            <div className={styles.outputRow}>
                <Field<string> name="outputModeLabel">
                    {({ field }) => (
                        <span className={styles.outputLabel}>
                            {field.value}
                        </span>
                    )}
                </Field>

                <Field<string> name="outputMode">
                    {({ field }) => (
                        <span className={styles.outputMode}>
                            {field.value}
                        </span>
                    )}
                </Field>
            </div>
        </div>
    </div>
)

export const useSimpleEditorProps = () => {
    return useMemo<FreeLayoutProps>(
        () => ({
            background: false,
            readonly: false,
            initialData,
            nodeRegistries,
            getNodeDefaultRegistry(type) {
                return {
                    type,
                    formMeta: {
                        render: () => {
                            if (type === 'llm') {
                                return renderLLMNode()
                            } else if (type === 'start') {
                                return renderInputNode()
                            } else if (type === 'end') {
                                return renderOutputNode()
                            }
                        }
                    }
                }
            },//节点内部显示的内容
            materials: {
                renderDefaultNode: (props: WorkflowNodeProps) => {
                    const { form } = useNodeRender()
                    return (
                        <WorkflowNodeRenderer
                            node={props.node}
                            className={styles.workflowNode}
                        >
                            {form?.render()}
                        </WorkflowNodeRenderer>
                    )
                }
            }, nodeEngine: {
                enable: true,
            },

            onContentChange(ctx) {
                console.log('当前画布数据：', ctx.document.toJSON())
            }
        }), []
    )
}