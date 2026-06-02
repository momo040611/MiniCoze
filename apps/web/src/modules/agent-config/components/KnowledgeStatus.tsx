import { Alert } from 'antd';

interface KnowledgeInfo {
  bound: boolean;
  knowledgeName?: string;
  retrievedCount?: number;
}

interface Props {
  knowledgeEvent: { type: string; runId: string; knowledge: KnowledgeInfo } | null;
  onClose: () => void;
}

export function KnowledgeStatus({ knowledgeEvent, onClose }: Props) {
  if (!knowledgeEvent) return null;

  const { knowledge } = knowledgeEvent;

  if (!knowledge.bound) {
    return (
      <Alert
        type="info"
        title="未绑定知识库，调试结果不包含知识检索"
        action={
          <a style={{ whiteSpace: 'nowrap', fontSize: 12 }} href="/knowledge-bases">
            去配置 →
          </a>
        }
        closable
        onClose={onClose}
        style={{ marginBottom: 0, borderRadius: 0, borderLeft: 0, borderRight: 0 }}
      />
    );
  }

  if (knowledge.retrievedCount === 0) {
    return (
      <Alert
        type="warning"
        title={`知识库「${knowledge.knowledgeName}」未检索到相关内容，请检查知识库配置`}
        closable
        onClose={onClose}
        style={{ marginBottom: 0, borderRadius: 0, borderLeft: 0, borderRight: 0 }}
      />
    );
  }

  if (knowledge.retrievedCount !== undefined && knowledge.retrievedCount > 0) {
    return (
      <Alert
        type="success"
        title={`从知识库「${knowledge.knowledgeName}」检索到 ${knowledge.retrievedCount} 条相关内容`}
        closable
        onClose={onClose}
        style={{ marginBottom: 0, borderRadius: 0, borderLeft: 0, borderRight: 0 }}
      />
    );
  }

  return (
    <Alert
      type="success"
      title={`已绑定知识库「${knowledge.knowledgeName}」`}
      closable
      onClose={onClose}
      style={{ marginBottom: 0, borderRadius: 0, borderLeft: 0, borderRight: 0 }}
    />
  );
}
