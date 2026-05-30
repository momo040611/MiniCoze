import { Badge, Tag } from 'antd';
import {
  DocumentStatus,
  KnowledgeStatus,
  type PipelineStepStatus,
} from '../../../api/knowledge-base';

type StatusValue = KnowledgeStatus | DocumentStatus | PipelineStepStatus;

type BadgeStatus = 'success' | 'processing' | 'error' | 'default' | 'warning';

function getStatusConfig(status: StatusValue): { text: string; color: string; badge: BadgeStatus } {
  switch (status) {
    case KnowledgeStatus.Active:
      return { text: '可用', color: 'green', badge: 'success' };
    case KnowledgeStatus.Indexing:
    case DocumentStatus.Uploading:
    case DocumentStatus.Parsing:
    case 'processing':
      return { text: '处理中', color: 'blue', badge: 'processing' };
    case KnowledgeStatus.Disabled:
      return { text: '已停用', color: 'default', badge: 'default' };
    case DocumentStatus.Completed:
    case 'success':
      return { text: '已完成', color: 'green', badge: 'success' };
    case DocumentStatus.Pending:
    case 'pending':
      return { text: '等待中', color: 'gold', badge: 'warning' };
    case DocumentStatus.Canceled:
      return { text: '已取消', color: 'default', badge: 'default' };
    case KnowledgeStatus.Failed:
    case DocumentStatus.Failed:
    case 'failed':
      return { text: '失败', color: 'red', badge: 'error' };
    default:
      return { text: status, color: 'default', badge: 'default' };
  }
}

type StatusBadgeProps = {
  status: StatusValue;
  compact?: boolean;
};

function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  if (compact) {
    return <Badge status={config.badge} text={config.text} />;
  }
  return <Tag color={config.color}>{config.text}</Tag>;
}

export { StatusBadge };
