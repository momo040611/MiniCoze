import { Field } from '@flowgram.ai/free-layout-editor';
import styles from './nodeRenderers.module.css';
import type { EndConfig, LLMConfig, NodeMeta, VariableInfo } from './types.ts';

type NodeConfig = LLMConfig & EndConfig & Record<string, unknown>;

const renderTitle = () => (
  <Field<NodeMeta> name="nodeMeta">
    {({ field }) => (
      <div className={styles.nodeTitle}>
        {field.value?.title || '未命名节点'}
      </div>
    )}
  </Field>
);

const renderVariables = (fieldName: 'inputs' | 'outputs') => (
  <Field<VariableInfo[]> name={fieldName}>
    {({ field }) => (
      <div className={styles.variableList}>
        {field.value?.map((item, index) => (
          <div className={styles.variableRow} key={`${item.name}-${index}`}>
            <span className={styles.variableLabel}>
              {fieldName === 'inputs' ? '输入' : '输出'}
            </span>

            <span className={styles.variableTag}>
              <span className={styles.variableType}>{item.type}</span>
              <span className={styles.dot}>.</span>
              <span className={styles.variableName}>{item.name || item.label}</span>
            </span>
          </div>
        ))}
      </div>
    )}
  </Field>
);

const renderConfigRow = (label: string, value?: unknown) => (
  <div className={styles.configRow}>
    <span className={styles.variableLabel}>{label}</span>
    <span className={styles.configText}>{String(value || '未配置')}</span>
  </div>
);

export const renderStartNode = () => (
  <div className={styles.inputNode}>
    {renderTitle()}
    {renderVariables('outputs')}
  </div>
);

export const renderInputNode = () => (
  <div className={styles.inputNode}>
    {renderTitle()}
    {renderVariables('outputs')}
  </div>
);

export const renderLLMNode = () => (
  <div className={styles.llmNode}>
    {renderTitle()}
    {renderVariables('inputs')}
    {renderVariables('outputs')}

    <Field<NodeConfig> name="config">
      {({ field }) => (
        <>
          {renderConfigRow('模型', field.value?.model)}
          {renderConfigRow('Prompt', field.value?.prompt)}
        </>
      )}
    </Field>
  </div>
);

export const renderConditionNode = () => (
  <div className={styles.conditionNode}>
    {renderTitle()}
    {renderVariables('inputs')}
    {renderVariables('outputs')}

    <Field<NodeConfig> name="config">
      {({ field }) => renderConfigRow('条件', field.value?.expression || field.value?.operator)}
    </Field>
  </div>
);

export const renderPluginNode = () => (
  <div className={styles.pluginNode}>
    {renderTitle()}
    {renderVariables('inputs')}
    {renderVariables('outputs')}

    <Field<NodeConfig> name="config">
      {({ field }) => (
        <>
          {renderConfigRow('插件', field.value?.pluginId)}
          {renderConfigRow('动作', field.value?.action)}
        </>
      )}
    </Field>
  </div>
);

export const renderDatabaseNode = () => (
  <div className={styles.databaseNode}>
    {renderTitle()}
    {renderVariables('inputs')}
    {renderVariables('outputs')}

    <Field<NodeConfig> name="config">
      {({ field }) => (
        <>
          {renderConfigRow('数据源', field.value?.source)}
          {renderConfigRow('查询', field.value?.query)}
        </>
      )}
    </Field>
  </div>
);

export const renderEndNode = () => (
  <div className={styles.outputNode}>
    {renderTitle()}
    {renderVariables('inputs')}

    <Field<EndConfig> name="config">
      {({ field }) => renderConfigRow('输出', field.value?.outputMode)}
    </Field>
  </div>
);

export const renderOutputNode = () => (
  <div className={styles.outputNode}>
    {renderTitle()}
    {renderVariables('inputs')}

    <Field<EndConfig> name="config">
      {({ field }) => renderConfigRow('输出', field.value?.outputMode)}
    </Field>
  </div>
);

export const renderGenericNode = () => (
  <div className={styles.genericNode}>
    {renderTitle()}
    {renderVariables('inputs')}
    {renderVariables('outputs')}
  </div>
);
