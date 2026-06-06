// 插件状态区块
import { ApiOutlined, CheckCircleFilled, CloudSyncOutlined } from '@ant-design/icons';
import { SectionCard } from './SectionCard';
import type { SectionState } from './SectionCard';

interface Props {
  state: SectionState;
  totalCount: number;
  enabledCount: number;
  updateCount: number;
  onGo: (path: string) => void;
  onRetry?: () => void;
}

export function PluginStatusSection({ state, totalCount, enabledCount, updateCount, onGo, onRetry }: Props) {
  return (
    <SectionCard
      state={state}
      title="插件状态"
      dotColor="#ec4899"
      action={{ label: '管理插件', onClick: () => onGo('/plugins') }}
      errorMsg="插件数据加载失败"
      onRetry={onRetry}
      emptyText="暂无已安装插件"
      emptyAction={{ label: '浏览插件', onClick: () => onGo('/plugins') }}
    >
      <div style={{ padding: '4px 22px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatItem icon={<ApiOutlined />} label="已安装" value={totalCount} color="#ec4899" />
          <StatItem icon={<CheckCircleFilled />} label="已启用" value={enabledCount} color="#22c55e" />
          <StatItem icon={<CloudSyncOutlined />} label="待更新" value={updateCount} color="#f59e0b" />
        </div>
      </div>
    </SectionCard>
  );
}

function StatItem({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: '14px 8px', borderRadius: 10,
      background: `${color}08`, border: `1px solid ${color}18`,
    }}>
      <span style={{ fontSize: 20, color }}>{icon}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#18202f' }}>{value}</span>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
    </div>
  );
}
