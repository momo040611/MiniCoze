import { ApiOutlined, AppstoreAddOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import styles from './index.module.css';

const pluginCapabilities = [
  {
    key: 'market',
    icon: <AppstoreAddOutlined />,
    title: '插件市场',
    description: '预留插件检索、安装、启用和版本管理能力。',
  },
  {
    key: 'auth',
    icon: <SafetyCertificateOutlined />,
    title: '授权配置',
    description: '预留 OAuth、API Key、Webhook 等外部服务授权配置。',
  },
  {
    key: 'runtime',
    icon: <ApiOutlined />,
    title: '调用记录',
    description: '预留插件调用日志、失败原因和调试追踪入口。',
  },
];

export function PluginsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Plugins</span>
        <h1>插件</h1>
        <p>管理智能体可调用的外部工具、授权配置和运行记录。</p>
      </div>

      <div className={styles.grid}>
        {pluginCapabilities.map((item) => (
          <article className={styles.panel} key={item.key}>
            <div className={styles.icon}>{item.icon}</div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
