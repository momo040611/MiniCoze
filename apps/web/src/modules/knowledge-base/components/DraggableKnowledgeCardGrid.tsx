import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Card, Space, Tag } from 'antd';
import { useRef, useState } from 'react';
import type { KnowledgeBase } from '../../../api/knowledge-base';
import { KnowledgeIcon } from './KnowledgeIcon';
import { indexModeText, retrievalModeText } from './labels';
import { StatusBadge } from './StatusBadge';
import styles from '../document/document.module.css';

type DraggableKnowledgeCardGridProps = {
  items: KnowledgeBase[];
  onOrderChange: (items: KnowledgeBase[]) => void;
  onOpen: (item: KnowledgeBase) => void;
  onEdit: (item: KnowledgeBase) => void;
  onDelete: (item: KnowledgeBase) => void;
};

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

const indexStatusText = {
  not_started: '未索引',
  indexing: '索引中',
  ready: '索引就绪',
  failed: '索引失败',
};

function DraggableKnowledgeCardGrid({
  items,
  onOrderChange,
  onOpen,
  onEdit,
  onDelete,
}: DraggableKnowledgeCardGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const suppressClickRef = useRef(false);

  const suppressNextClick = () => {
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const moveItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = items.findIndex((item) => item.id === fromId);
    const toIndex = items.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onOrderChange(next);
  };

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <Card
          className={`${styles.kbCard} ${draggingId === item.id ? styles.draggingCard : ''} ${overId === item.id ? styles.dropTarget : ''}`}
          draggable
          key={item.id}
          onClick={() => {
            if (!suppressClickRef.current) onOpen(item);
          }}
          onDragStart={(event) => {
            setDraggingId(item.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.id);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setOverId(item.id);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const fromId = event.dataTransfer.getData('text/plain');
            moveItem(fromId, item.id);
            setDraggingId(null);
            setOverId(null);
            suppressNextClick();
          }}
          onDragEnd={() => {
            setDraggingId(null);
            setOverId(null);
            suppressNextClick();
          }}
        >
          <div className={styles.cardHead}>
            <KnowledgeIcon value={item} />
            <div>
              <h2 className={styles.cardTitle}>{item.name}</h2>
              <StatusBadge status={item.status} />
            </div>
          </div>
          <p className={styles.cardDesc}>{item.description}</p>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span>文档数</span>
              <strong>{item.documentCount}</strong>
            </div>
            <div className={styles.metric}>
              <span>分段数</span>
              <strong>{item.chunkCount}</strong>
            </div>
          </div>
          <div className={styles.qualityLine}>
            <div className={styles.qualityItem}>
              向量数
              <strong>{item.vectorCount ?? item.chunkCount}</strong>
            </div>
            <div className={styles.qualityItem}>
              索引状态
              <strong>{indexStatusText[item.indexStatus ?? 'ready']}</strong>
            </div>
            <div className={styles.qualityItem}>
              Owner
              <strong>{item.owner ?? 'MiniCoze'}</strong>
            </div>
          </div>
          <div className={styles.metaLine}>
            <Tag>{item.embeddingConfig.embeddingModel}</Tag>
            <Tag color="blue">{retrievalModeText[item.retrievalConfig.retrievalMode]}</Tag>
            <Tag>{indexModeText[item.indexMode]}</Tag>
            {item.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>)}
          </div>
          <div className={styles.metaLine}>
            <span>更新时间 {formatTime(item.updatedAt)}</span>
          </div>
          <div className={styles.cardActions} onClick={(event) => event.stopPropagation()}>
            <Space>
              <Button onClick={() => onOpen(item)}>进入详情</Button>
              <Button icon={<EditOutlined />} onClick={() => onEdit(item)}>
                编辑
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => onDelete(item)}>
                删除
              </Button>
            </Space>
          </div>
        </Card>
      ))}
    </div>
  );
}

export { DraggableKnowledgeCardGrid };
