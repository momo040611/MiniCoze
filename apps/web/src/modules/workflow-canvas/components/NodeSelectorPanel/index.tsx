import {
  ApiOutlined,
  BookOutlined,
  BranchesOutlined,
  CodeOutlined,
  ExportOutlined,
  GlobalOutlined,
  ImportOutlined,
  RobotOutlined,
  SearchOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { Input } from 'antd';
import type { ReactNode } from 'react';
import styles from './index.module.css';

type NodeType =
  | 'llm'
  | 'condition'
  | 'plugin'
  | 'knowledge'
  | 'code'
  | 'http'
  | 'variable'
  | 'input'
  | 'output';

interface NodeSelectorPanelProps {
  onAddNode: (type: NodeType) => void;
}

const nodeGroups: Array<{
  title: string;
  items: Array<{
    label: string;
    type: NodeType;
    icon: ReactNode;
  }>;
}> = [
  {
    title: '常用节点',
    items: [
      { label: '大模型', type: 'llm', icon: <RobotOutlined /> },
      { label: '条件判断', type: 'condition', icon: <BranchesOutlined /> },
      { label: '插件调用', type: 'plugin', icon: <ApiOutlined /> },
      { label: '知识检索', type: 'knowledge', icon: <BookOutlined /> },
    ],
  },
  {
    title: '数据处理',
    items: [
      { label: '代码执行', type: 'code', icon: <CodeOutlined /> },
      { label: 'HTTP 请求', type: 'http', icon: <GlobalOutlined /> },
      { label: '变量读写', type: 'variable', icon: <TagsOutlined /> },
    ],
  },
  {
    title: '输入与输出',
    items: [
      { label: '输入', type: 'input', icon: <ImportOutlined /> },
      { label: '输出', type: 'output', icon: <ExportOutlined /> },
    ],
  },
];

export default function NodeSelectorPanel({ onAddNode }: NodeSelectorPanelProps) {
  return (
    <div className={styles.panel}>
      <Input
        prefix={<SearchOutlined />}
        placeholder="搜索节点"
        className={styles.search}
      />

      {nodeGroups.map((group) => (
        <div key={group.title} className={styles.group}>
          <div className={styles.groupTitle}>{group.title}</div>

          <div className={styles.grid}>
            {group.items.map((item) => (
              <div
                key={item.type}
                className={styles.nodeItem}
                onClick={() => onAddNode(item.type)}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
