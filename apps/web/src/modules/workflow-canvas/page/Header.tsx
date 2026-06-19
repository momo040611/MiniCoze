import {
  CheckCircleOutlined,
  EditOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Empty, List, Spin, Tag, Typography, message } from 'antd';
import { publishWorkflow } from '../../../api/publish';
import {
  getWorkflowVersionsRemote,
  type Workflow,
  type WorkflowVersion,
} from '../../../api/workflows';
import { Tooltip } from '../components/Tooltip';
import styles from './Header.module.css';

interface HeaderProps {
  workflow?: Pick<Workflow, 'id' | 'name' | 'description' | 'status' | 'updatedAt'> | null;
  saveStatus?: 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';
  lastSavedAt?: string | null;
  onPublished?: () => Promise<void> | void;
}

function Header({ workflow, saveStatus = 'idle', lastSavedAt, onPublished }: HeaderProps) {
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const workflowName = workflow?.name ?? '未命名工作流';
  const workflowDesc = workflow?.description || '暂无工作流介绍';
  const updatedText = workflow?.updatedAt
    ? `最近更新 ${new Date(workflow.updatedAt).toLocaleString()}`
    : '尚未保存';
  const statusText = workflow?.status === 'ACTIVE'
    ? '已发布'
    : workflow?.status === 'ARCHIVED'
      ? '已归档'
      : '草稿';

  const saveStatusText = (() => {
    if (saveStatus === 'dirty') return '有未保存修改';
    if (saveStatus === 'saving') return '保存中...';
    if (saveStatus === 'saved') return `已保存${lastSavedAt ? ` ${lastSavedAt}` : ''}`;
    if (saveStatus === 'failed') return '保存失败';
    return updatedText;
  })();

  async function loadHistory() {
    if (!workflow?.id) {
      return;
    }

    setHistoryLoading(true);

    try {
      const data = await getWorkflowVersionsRemote(workflow.id);
      setVersions(data);
    } catch (error) {
      console.error('Load workflow versions failed:', error);
      message.error(error instanceof Error ? error.message : '历史记录加载失败');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleOpenHistory() {
    if (!workflow?.id) {
      message.warning('当前工作流不存在，无法查看历史记录');
      return;
    }

    setHistoryOpen(true);
    await loadHistory();
  }

  async function handlePublish() {
    if (!workflow?.id || publishing) return;

    setPublishing(true);
    try {
      const result = await publishWorkflow(workflow.id);
      await onPublished?.();
      await loadHistory();
      message.success(`已发布为 v${result.version}`);
    } catch (error) {
      console.error('Publish workflow failed:', error);
      message.error(error instanceof Error ? error.message : '发布失败，请检查工作流配置');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <div className={styles.backbox}>
          <button className={styles.back} type="button" onClick={() => navigate('/workflows')}>
            <LeftOutlined style={{ fontSize: 14 }} />
          </button>
        </div>

        <img className={styles.logo} src="/favicon.png" alt="" />

        <div className={styles.workflowinfo}>
          <div className={styles.workflowinfoTop}>
            <Tooltip text={workflowName}>
              <span className={styles.workflowTitle}>{workflowName}</span>
            </Tooltip>

            <Tooltip text={workflowDesc}>
              <button className={styles.workflowintroduction} type="button" title={workflowDesc}>
                <InfoCircleOutlined style={{ fontSize: 14 }} />
              </button>
            </Tooltip>

            <Tooltip text={statusText}>
              <button className={styles.workflowpublish} type="button">
                <CheckCircleOutlined style={{ fontSize: 14 }} />
              </button>
            </Tooltip>

            <Tooltip text="编辑">
              <button className={styles.workfloweditor} type="button">
                <EditOutlined style={{ fontSize: 14 }} />
              </button>
            </Tooltip>
          </div>

          <div className={styles.workflowinfoBottom}>
            <div className={`${styles.saveTime} ${styles[`saveStatus-${saveStatus}`]}`}>
              {saveStatusText}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <Tooltip text="历史记录">
          <div className={styles.history}>
            <button type="button" onClick={handleOpenHistory}>
              <HistoryOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </Tooltip>

        <div className={styles.publish}>
          <button type="button" onClick={handlePublish} disabled={publishing}>
            <span>发布</span>
          </button>
        </div>

        <div>
          <button type="button">
            <MoreOutlined style={{ fontSize: 14 }} />
          </button>
        </div>
      </div>

      <Drawer
        title="历史记录"
        open={historyOpen}
        width={420}
        onClose={() => setHistoryOpen(false)}
        destroyOnHidden
      >
        {historyLoading ? (
          <div className={styles.historyLoading}>
            <Spin />
          </div>
        ) : versions.length > 0 ? (
          <List
            dataSource={versions}
            renderItem={(version) => (
              <List.Item className={styles.historyItem}>
                <List.Item.Meta
                  title={
                    <div className={styles.historyItemTitle}>
                      <span>版本 v{version.version}</span>
                      {version.isPublished && <Tag color="success">已发布</Tag>}
                    </div>
                  }
                  description={
                    <div className={styles.historyItemDescription}>
                      <Typography.Text type="secondary">
                        发布时间：{version.publishedAt ?? version.createdAt}
                      </Typography.Text>
                      {version.changelog && (
                        <Typography.Paragraph className={styles.historyChangelog}>
                          {version.changelog}
                        </Typography.Paragraph>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无历史记录" />
        )}
      </Drawer>
    </div>
  );
}

export default Header;
