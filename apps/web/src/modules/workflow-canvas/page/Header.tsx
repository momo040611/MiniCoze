import {
  CheckCircleOutlined,
  CopyOutlined,
  EditOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Workflow } from '../../../api/workflows';
import { Tooltip } from '../components/Tooltip';
import styles from './Header.module.css';

interface HeaderProps {
  workflow?: Pick<Workflow, 'name' | 'description' | 'status' | 'updatedAt'> | null;
  saveStatus?: 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';
  lastSavedAt?: string | null;
}

function Header({ workflow, saveStatus = 'idle', lastSavedAt }: HeaderProps) {
  const navigate = useNavigate();
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

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <div className={styles.backbox}>
          <button className={styles.back} onClick={() => navigate('/workflows')}>
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
              <button className={styles.workflowintroduction} title={workflowDesc}>
                <InfoCircleOutlined style={{ fontSize: 14 }} />
              </button>
            </Tooltip>

            <Tooltip text={statusText}>
              <button className={styles.workflowpublish}>
                <CheckCircleOutlined style={{ fontSize: 14 }} />
              </button>
            </Tooltip>

            <Tooltip text="编辑">
              <button className={styles.workfloweditor}>
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
        <Tooltip text="查看引用关系">
          <div className={styles.check}>
            <button>
              <CopyOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </Tooltip>

        <Tooltip text="历史记录">
          <div className={styles.history}>
            <button>
              <HistoryOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </Tooltip>

        <div className={styles.publish}>
          <button>
            <span>发布</span>
          </button>
        </div>

        <div>
          <button>
            <MoreOutlined style={{ fontSize: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Header;
