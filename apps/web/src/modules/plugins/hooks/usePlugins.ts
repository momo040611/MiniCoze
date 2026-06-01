import { useCallback, useEffect, useState } from 'react';
import { getPlugins, togglePlugin, type IPlugin } from '../../../api/plugins';

interface IUsePluginsResult {
  data: IPlugin[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggle: (pluginId: string, enabled: boolean) => Promise<void>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '插件列表加载失败';
}

export function usePlugins(): IUsePluginsResult {
  const [data, setData] = useState<IPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const plugins = await getPlugins();
      setData(plugins);
    } catch (err) {
      setError(getErrorMessage(err));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(async (pluginId: string, enabled: boolean) => {
    await togglePlugin(pluginId, enabled);
    setData((current) =>
      current.map((plugin) => (plugin.id === pluginId ? { ...plugin, enabled } : plugin)),
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh, toggle };
}
