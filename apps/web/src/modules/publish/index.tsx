// 发布管理中心 — 统一管理智能体与工作流的发布生命周期

import { Tabs } from 'antd';
import { RobotOutlined, BranchesOutlined } from '@ant-design/icons';
import { AgentPublishPanel } from './components/AgentPublishPanel';
import { WorkflowPublishPanel } from './components/WorkflowPublishPanel';
import styles from './index.module.css';

const tabItems = [
  {
    key: 'agent',
    label: (
      <span>
        <RobotOutlined /> 智能体发布
      </span>
    ),
    children: <AgentPublishPanel />,
  },
  {
    key: 'workflow',
    label: (
      <span>
        <BranchesOutlined /> 工作流发布
      </span>
    ),
    children: <WorkflowPublishPanel />,
  },
];

export function PublishPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Publish</span>
        <h1>发布管理</h1>
        <p>统一管理智能体和工作流的发布、下线与版本生命周期。</p>
      </div>

      <Tabs
        defaultActiveKey="agent"
        items={tabItems}
        className={styles.tabs}
      />
    </section>
  );
}
