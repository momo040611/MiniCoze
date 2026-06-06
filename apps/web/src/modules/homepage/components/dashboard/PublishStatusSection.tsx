// 发布状态区块
import { CloudUploadOutlined, RocketOutlined } from '@ant-design/icons';

interface Props {
  publishPendingCount: number;
  onGo: (path: string) => void;
}

export function PublishStatusSection({ publishPendingCount, onGo }: Props) {
  return (
    <div
      onClick={() => onGo('/publish')}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 22px', borderRadius: 12, cursor: 'pointer',
        background: publishPendingCount > 0
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(239, 68, 68, 0.04))'
          : 'rgba(34, 197, 94, 0.04)',
        border: `1px solid ${publishPendingCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.12)'}`,
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 22,
        background: publishPendingCount > 0
          ? 'linear-gradient(135deg, #f59e0b, #d97706)'
          : 'linear-gradient(135deg, #22c55e, #16a34a)',
        color: '#fff', flexShrink: 0,
      }}>
        {publishPendingCount > 0 ? <CloudUploadOutlined /> : <RocketOutlined />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#18202f' }}>
          {publishPendingCount > 0 ? '待发布项' : '全部已发布'}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
          {publishPendingCount > 0
            ? `${publishPendingCount} 个项目等待发布，点击前往发布管理`
            : '所有项目均已发布上线，运行正常'
          }
        </div>
      </div>
      <span style={{ fontSize: 20, color: '#6b7280' }}>→</span>
    </div>
  );
}
