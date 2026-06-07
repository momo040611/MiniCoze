import { useEffect, useRef, useState } from 'react';
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
        {(Array.isArray(field.value) ? field.value : []).map((item, index) => (
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

function AnnotationEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value ?? '');
    }
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className={styles.annotationTextarea}
        value={draft}
        placeholder="输入要添加的注释..."
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(event.target.value);
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div
      className={`${styles.annotationText} ${value ? '' : styles.annotationPlaceholder}`}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
      title="双击编辑注释"
    >
      {value || '输入要添加的注释...'}
    </div>
  );
}

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

export const renderAnnotationNode = () => (
  <div className={styles.annotationNode}>
    <Field<NodeMeta> name="nodeMeta">
      {({ field }) => (
        <AnnotationEditor
          value={field.value?.description}
          onChange={(value) => {
            const nextMeta = {
              ...(field.value ?? { title: '注释' }),
              description: value,
            };
            const writableField = field as typeof field & {
              onChange?: (value: NodeMeta) => void;
              setValue?: (value: NodeMeta) => void;
            };

            writableField.onChange?.(nextMeta);
            writableField.setValue?.(nextMeta);
          }}
        />
      )}
    </Field>
  </div>
);
