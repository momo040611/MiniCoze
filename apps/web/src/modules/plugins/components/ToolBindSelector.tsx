import { App, Button, Checkbox, Collapse, Empty, Spin, Tag } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  bindAgentTools,
  getAgentToolBinding,
  getPluginDetail,
  getPlugins,
  type IPluginDetail,
  type IPluginTool,
} from '../../../api/plugins';
import styles from './ToolBindSelector.module.css';

interface IToolBindSelectorProps {
  agentId: string;
  onSaved?: (toolIds: string[]) => void;
}

interface IGroupedTool {
  plugin: IPluginDetail;
  tools: IPluginTool[];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '工具绑定加载失败';
}

export function ToolBindSelector({ agentId, onSaved }: IToolBindSelectorProps) {
  const { message } = App.useApp();
  const [groups, setGroups] = useState<IGroupedTool[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledToolIds = useMemo(
    () => new Set(groups.flatMap((group) => group.tools.map((tool) => tool.id))),
    [groups],
  );

  const selectedTools = useMemo(
    () =>
      groups
        .flatMap((group) => group.tools)
        .filter((tool) => selectedToolIds.includes(tool.id)),
    [groups, selectedToolIds],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plugins, binding] = await Promise.all([getPlugins(), getAgentToolBinding(agentId)]);
      const details = await Promise.all(
        plugins.filter((plugin) => plugin.enabled).map((plugin) => getPluginDetail(plugin.id)),
      );
      const nextGroups = details.map((plugin) => ({
        plugin,
        tools: plugin.tools.filter((tool) => tool.enabled),
      }));
      const validToolIds = new Set(nextGroups.flatMap((group) => group.tools.map((tool) => tool.id)));
      setGroups(nextGroups);
      setSelectedToolIds(binding.toolIds.filter((toolId) => validToolIds.has(toolId)));
    } catch (err) {
      const nextError = getErrorMessage(err);
      setError(nextError);
      message.error(nextError);
    } finally {
      setLoading(false);
    }
  }, [agentId, message]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = (toolId: string, checked: boolean) => {
    setSelectedToolIds((current) => {
      if (checked) {
        return current.includes(toolId) ? current : [...current, toolId];
      }
      return current.filter((id) => id !== toolId);
    });
  };

  const handleSave = async () => {
    const validToolIds = selectedToolIds.filter((toolId) => enabledToolIds.has(toolId));
    setSaving(true);
    try {
      await bindAgentTools(agentId, validToolIds);
      setSelectedToolIds(validToolIds);
      message.success('工具绑定已保存');
      onSaved?.(validToolIds);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.center}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.center}>
        <Empty description={error}>
          <Button onClick={refresh}>重新加载</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.selector}>
      <div className={styles.columns}>
        <div className={styles.available}>
          <div className={styles.sectionTitle}>可选工具</div>
          {groups.length === 0 ? (
            <Empty description="暂无已启用插件工具" />
          ) : (
            <Collapse
              items={groups.map((group) => ({
                key: group.plugin.id,
                label: (
                  <span className={styles.pluginLabel}>
                    {group.plugin.name}
                    <Tag color="blue">{group.tools.length} 个工具</Tag>
                  </span>
                ),
                children: (
                  <div className={styles.toolList}>
                    {group.tools.map((tool) => (
                      <label className={styles.toolItem} key={tool.id}>
                        <Checkbox
                          checked={selectedToolIds.includes(tool.id)}
                          onChange={(event) => handleToggle(tool.id, event.target.checked)}
                        />
                        <span>
                          <strong>{tool.name}</strong>
                          <small>{tool.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ),
              }))}
            />
          )}
        </div>

        <div className={styles.bound}>
          <div className={styles.sectionTitle}>已绑定工具</div>
          {selectedTools.length === 0 ? (
            <Empty description="尚未绑定工具" />
          ) : (
            <div className={styles.boundList}>
              {selectedTools.map((tool) => (
                <div className={styles.boundItem} key={tool.id}>
                  <span>{tool.name}</span>
                  <Button size="small" onClick={() => handleToggle(tool.id, false)}>
                    移除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <Button onClick={refresh}>刷新</Button>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存绑定
        </Button>
      </div>
    </div>
  );
}
