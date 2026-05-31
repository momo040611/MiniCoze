import { Field } from '@flowgram.ai/free-layout-editor'
import styles from './nodeRenderers.module.css'
import type { NodeMeta, VariableInfo, LLMConfig, EndConfig } from './types.ts'

const renderTitle = () => (
    <Field<NodeMeta> name="nodeMeta">
        {({ field }) => (
            <div className={styles.nodeTitle}>
                {field.value?.title}
            </div>
        )}
    </Field>
)
const renderVariables = (fieldName: 'inputs' | 'outputs') => (
    <Field<VariableInfo[]> name={fieldName}>
        {({ field }) => (
            <div className={styles.variableList}>
                {field.value?.map((item, index) => (
                    <div className={styles.variableRow} key={index}>
                        <span className={styles.variableLabel}>
                            {item.label}
                        </span>

                        <span className={styles.variableTag}>
                            <span className={styles.variableType}>
                                {item.type}
                            </span>
                            <span className={styles.dot}>.</span>
                            <span className={styles.variableName}>
                                {item.name}
                            </span>
                        </span>
                    </div>
                ))}
            </div>
        )}
    </Field>
)

export const renderStartNode = () => (
    <div className={styles.inputNode}>
        {renderTitle()}
        {renderVariables('outputs')}
    </div>
)

export const renderInputNode = () => (
    <div className={styles.inputNode}>
        {renderTitle()}
        {renderVariables('outputs')}
    </div>
)

export const renderLLMNode = () => (
    <div className={styles.llmNode}>
        {renderTitle()}
        {renderVariables('inputs')}
        {renderVariables('outputs')}

        <Field<LLMConfig> name="config">
            {({ field }) => (
                <>
                    <div className={styles.configRow}>
                        <span className={styles.variableLabel}>
                            模型
                        </span>
                        <span className={styles.configText}>
                            {field.value?.model || '未配置模型'}
                        </span>
                    </div>

                    <div className={styles.configRow}>
                        <span className={styles.variableLabel}>
                            Prompt
                        </span>
                        <span className={styles.configText}>
                            {field.value?.prompt || '未配置 Prompt'}
                        </span>
                    </div>
                </>
            )}
        </Field>
    </div>
)

export const renderEndNode = () => (
    <div className={styles.outputNode}>
        {renderTitle()}
        {renderVariables('inputs')}

        <Field<EndConfig> name="config">
            {({ field }) => (
                <div className={styles.configRow}>
                    <span className={styles.variableLabel}>
                        输出类型
                    </span>
                    <span className={styles.configText}>
                        {field.value?.outputMode}
                    </span>
                </div>
            )}
        </Field>
    </div>
)

export const renderOutputNode = () => (
    <div className={styles.outputNode}>
        {renderTitle()}
        {renderVariables('inputs')}

        <Field<EndConfig> name="config">
            {({ field }) => (
                <div className={styles.configRow}>
                    <span className={styles.variableLabel}>
                        输出类型
                    </span>
                    <span className={styles.configText}>
                        {field.value?.outputMode}
                    </span>
                </div>
            )}
        </Field>
    </div>
)