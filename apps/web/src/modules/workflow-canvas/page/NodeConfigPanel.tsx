import { useEffect, useMemo } from 'react'
import { Button, Form, Input, Select } from 'antd'
import {
    FlowNodeFormData,
    WorkflowContentChangeType,
    getNodeForm,
    type WorkflowNodeEntity,
} from '@flowgram.ai/free-layout-editor'
import type { EndConfig, LLMConfig, NodeMeta, VariableInfo } from '../nodeRenders/types'
import styles from './NodeConfigPanel.module.css'

type NodeData = {
    nodeMeta?: NodeMeta
    inputs?: VariableInfo[]
    outputs?: VariableInfo[]
    config?: LLMConfig & EndConfig & Record<string, unknown>
}

type NodeConfigPanelProps = {
    selectedNode: WorkflowNodeEntity | null
}

const VARIABLE_TYPE_OPTIONS = [
    { label: 'string', value: 'string' },
    { label: 'number', value: 'number' },
    { label: 'boolean', value: 'boolean' },
    { label: 'object', value: 'object' },
    { label: 'array', value: 'array' },
]

const MODEL_OPTIONS = [
    { label: 'deepseek-chat', value: 'deepseek-chat' },
    { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
    { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
]

function getNodeData(node: WorkflowNodeEntity | null): NodeData {
    if (!node) {
        return {}
    }

    const nodeForm = getNodeForm(node) as
        | {
            values?: NodeData
        }
        | undefined

    if (nodeForm?.values) {
        return nodeForm.values
    }

    const nodeAny = node as unknown as {
        toJSON?: () => { data?: NodeData }
        getExtInfo?: () => NodeData
    }

    return nodeAny.toJSON?.().data ?? nodeAny.getExtInfo?.() ?? {}
}

function syncFlowGramForm(node: WorkflowNodeEntity, data: NodeData) {
    const nodeAny = node as unknown as {
        getData?: (key: unknown) => unknown
        updateExtInfo?: (data: NodeData, fire?: boolean) => void
        document?: {
            fireContentChange?: (event: unknown) => void
        }
    }
    const nodeForm = getNodeForm(node) as
        | {
            updateFormValues?: (values: NodeData) => void
            setValueIn?: (name: string, value: unknown) => void
        }
        | undefined
    const formData = nodeAny.getData?.(FlowNodeFormData) as
        | {
            updateFormValues?: (values: NodeData) => void
            getFormModel?: () => {
                updateFormValues?: (values: NodeData) => void
                setValueIn?: (name: string, value: unknown) => void
            }
        }
        | undefined
    const formModel = formData?.getFormModel?.()

    nodeForm?.updateFormValues?.(data)
    formData?.updateFormValues?.(data)
    formModel?.updateFormValues?.(data)

    nodeForm?.setValueIn?.('nodeMeta', data.nodeMeta)
    nodeForm?.setValueIn?.('inputs', data.inputs)
    nodeForm?.setValueIn?.('outputs', data.outputs)
    nodeForm?.setValueIn?.('config', data.config)
    formModel?.setValueIn?.('nodeMeta', data.nodeMeta)
    formModel?.setValueIn?.('inputs', data.inputs)
    formModel?.setValueIn?.('outputs', data.outputs)
    formModel?.setValueIn?.('config', data.config)

    nodeAny.updateExtInfo?.(data, true)
    nodeAny.document?.fireContentChange?.({
        type: WorkflowContentChangeType.NODE_DATA_CHANGE,
        entity: node,
        toJSON: () => data,
    })
}

function getDefaultData(node: WorkflowNodeEntity | null): NodeData {
    const data = getNodeData(node)
    const type = node?.flowNodeType

    return {
        nodeMeta: {
            title: data.nodeMeta?.title || String(type ?? '未命名节点'),
            subTitle: data.nodeMeta?.subTitle,
            description: data.nodeMeta?.description,
        },
        inputs: data.inputs ?? (type === 'start' || type === 'input' ? [] : [
            { label: '输入', type: 'string', name: 'query' },
        ]),
        outputs: data.outputs ?? (type === 'end' || type === 'output' ? [] : [
            { label: '输出', type: 'string', name: 'content' },
        ]),
        config: data.config ?? {},
    }
}

function VariableList({ name, title }: { name: 'inputs' | 'outputs'; title: string }) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionTitle}>{title}</div>
            <Form.List name={name}>
                {(fields, { add, remove }) => (
                    <div className={styles.variableList}>
                        {fields.map((field) => (
                            <div className={styles.variableCard} key={field.key}>
                                <Form.Item
                                    {...field}
                                    label="显示名"
                                    name={[field.name, 'label']}
                                    rules={[{ required: true, message: '请输入显示名' }]}
                                >
                                    <Input placeholder="输入" />
                                </Form.Item>
                                <Form.Item
                                    {...field}
                                    label="变量名"
                                    name={[field.name, 'name']}
                                    rules={[{ required: true, message: '请输入变量名' }]}
                                >
                                    <Input placeholder="query" />
                                </Form.Item>
                                <Form.Item
                                    {...field}
                                    label="类型"
                                    name={[field.name, 'type']}
                                    rules={[{ required: true, message: '请选择类型' }]}
                                >
                                    <Select options={VARIABLE_TYPE_OPTIONS} />
                                </Form.Item>
                                <Button danger type="link" onClick={() => remove(field.name)}>
                                    删除变量
                                </Button>
                            </div>
                        ))}
                        <Button type="dashed" block onClick={() => add({ label: '变量', type: 'string', name: 'value' })}>
                            添加变量
                        </Button>
                    </div>
                )}
            </Form.List>
        </div>
    )
}

function NodeConfigPanel({ selectedNode }: NodeConfigPanelProps) {
    const [form] = Form.useForm<NodeData>()
    const nodeType = selectedNode?.flowNodeType
    const nodeTitle = useMemo(() => {
        if (!selectedNode) {
            return '节点配置'
        }

        return `${getDefaultData(selectedNode).nodeMeta?.title ?? selectedNode.flowNodeType} 配置`
    }, [selectedNode])

    useEffect(() => {
        form.setFieldsValue(getDefaultData(selectedNode))
    }, [form, selectedNode])

    function handleValuesChange(_: unknown, values: NodeData) {
        if (!selectedNode) {
            return
        }

        const nextData: NodeData = {
            nodeMeta: {
                title: values.nodeMeta?.title || String(selectedNode.flowNodeType),
                subTitle: values.nodeMeta?.subTitle,
                description: values.nodeMeta?.description,
                icon: values.nodeMeta?.icon,
                mainColor: values.nodeMeta?.mainColor,
            },
            inputs: values.inputs ?? [],
            outputs: values.outputs ?? [],
            config: values.config ?? {},
        }

        syncFlowGramForm(selectedNode, nextData)
    }

    return (
        <aside className={styles.configPanel}>
            <div className={styles.header}>
                <div>
                    <div className={styles.title}>{nodeTitle}</div>
                    <div className={styles.subTitle}>
                        {selectedNode ? `类型：${selectedNode.flowNodeType}` : '请选择画布中的节点'}
                    </div>
                </div>
            </div>

            {!selectedNode ? (
                <div className={styles.empty}>点击画布节点后，在这里修改节点名称、变量和模型参数。</div>
            ) : (
                <Form
                    form={form}
                    layout="vertical"
                    className={styles.form}
                    onValuesChange={handleValuesChange}
                >
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>基础信息</div>
                        <Form.Item
                            label="节点名称"
                            name={['nodeMeta', 'title']}
                            rules={[{ required: true, message: '请输入节点名称' }]}
                        >
                            <Input placeholder="请输入节点名称" />
                        </Form.Item>
                        <Form.Item label="节点说明" name={['nodeMeta', 'description']}>
                            <Input.TextArea rows={3} placeholder="请输入节点说明" />
                        </Form.Item>
                    </div>

                    {nodeType !== 'start' && nodeType !== 'input' && (
                        <VariableList name="inputs" title="输入变量" />
                    )}

                    {nodeType !== 'end' && nodeType !== 'output' && (
                        <VariableList name="outputs" title="输出变量" />
                    )}

                    {nodeType === 'llm' && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>模型配置</div>
                            <Form.Item label="模型" name={['config', 'model']}>
                                <Select options={MODEL_OPTIONS} placeholder="请选择模型" />
                            </Form.Item>
                            <Form.Item label="System Prompt" name={['config', 'systemPrompt']}>
                                <Input.TextArea rows={4} placeholder="设置模型角色和约束" />
                            </Form.Item>
                            <Form.Item label="Prompt" name={['config', 'prompt']}>
                                <Input.TextArea rows={5} placeholder="输入模型执行任务的提示词" />
                            </Form.Item>
                        </div>
                    )}

                    {(nodeType === 'end' || nodeType === 'output') && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>输出配置</div>
                            <Form.Item label="输出方式" name={['config', 'outputMode']}>
                                <Select
                                    options={[
                                        { label: '返回变量', value: '返回变量' },
                                        { label: '返回文本', value: '返回文本' },
                                    ]}
                                />
                            </Form.Item>
                        </div>
                    )}
                </Form>
            )}
        </aside>
    )
}

export default NodeConfigPanel
