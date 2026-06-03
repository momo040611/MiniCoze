import { App, Breadcrumb, Button, Card, Empty, Popconfirm, Spin, Tag } from 'antd';
import {
  ApiOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePlugins } from '../hooks/usePlugins';
import type { IPlugin } from '../../../api/plugins';
import styles from './PluginList.module.css';

const iconMap: Record<string, ReactNode> = {
  SearchOutlined: <SearchOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  FunctionOutlined: <FunctionOutlined />,
};

function PluginIcon({ plugin }: { plugin: IPlugin }) {
  return <div className={styles.icon}>{plugin.icon ? iconMap[plugin.icon] ?? <ApiOutlined /> : <ToolOutlined />}</div>;
}

export function PluginList() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { data, loading, error, refresh, toggle } = usePlugins();

  const handleToggle = async (plugin: IPlugin, enabled: boolean) => {
    try {
      await toggle(plugin.id, enabled);
      message.success(enabled ? '插件已启用' : '插件已停用');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '插件状态更新失败');
    }
  };

  if (loading) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <Breadcrumb items={[{ title: '插件管理' }]} />
        <div className={styles.titleRow}>
          <div>
            <h1>插件管理</h1>
            <p>管理内置插件、测试工具能力，并为智能体绑定可调用工具。</p>
          </div>
          <Button onClick={refresh}>刷新</Button>
        </div>
      </div>

      {error ? (
        <div className={styles.center}>
          <Empty description={error}>
            <Button onClick={refresh}>重新加载</Button>
          </Empty>
        </div>
      ) : data.length === 0 ? (
        <div className={styles.center}>
          <Empty description="暂无插件" />
        </div>
      ) : (
        <div className={styles.grid}>
          {data.map((plugin) => (
            <Card
              hoverable
              className={styles.card}
              key={plugin.id}
              onClick={() => navigate(`/plugins/${plugin.id}`)}
              actions={[
                <Link key="detail" to={`/plugins/${plugin.id}`} onClick={(event) => event.stopPropagation()}>
                  查看详情
                </Link>,
                <Popconfirm
                  key="toggle"
                  title={plugin.enabled ? '停用插件' : '启用插件'}
                  description={plugin.enabled ? '停用后，该插件下的工具将不可绑定和调用。' : '启用后，该插件工具可用于测试和绑定。'}
                  okText="确认"
                  cancelText="取消"
                  onConfirm={(event) => {
                    event?.stopPropagation();
                    void handleToggle(plugin, !plugin.enabled);
                  }}
                >
                  <Button type="link" onClick={(event) => event.stopPropagation()}>
                    {plugin.enabled ? '停用' : '启用'}
                  </Button>
                </Popconfirm>,
              ]}
            >
              <div className={styles.cardContent}>
                <PluginIcon plugin={plugin} />
                <div className={styles.cardMain}>
                  <div className={styles.cardTitle}>
                    <h2>{plugin.name}</h2>
                    <Tag color={plugin.enabled ? '#52c41a' : 'default'}>{plugin.enabled ? '已启用' : '已停用'}</Tag>
                  </div>
                  <p>{plugin.description}</p>
                  <div className={styles.meta}>
                    <span>版本 {plugin.version}</span>
                    <span>{plugin.toolCount} 个工具</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
