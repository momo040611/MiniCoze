import { useCallback, useEffect, useState } from 'react';
import { getPluginDetail, togglePlugin, type IPluginDetail } from '../../../api/plugins';

interface IUsePluginDetailResult {
  data: IPluginDetail | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggle: (enabled: boolean) => Promise<void>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '插件详情加载失败';
}

export function usePluginDetail(pluginId?: string): IUsePluginDetailResult {
  const [data, setData] = useState<IPluginDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pluginId) {
      setData(null);
      setError('缺少插件 ID');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setData(await getPluginDetail(pluginId));
    } catch (err) {
      setError(getErrorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [pluginId]);

  const toggle = useCallback(
    async (enabled: boolean) => {
      if (!pluginId) return;
      await togglePlugin(pluginId, enabled);
      setData((current) =>
        current
          ? {
              ...current,
              enabled,
              tools: current.tools.map((tool) => ({ ...tool, enabled: enabled && tool.enabled })),
            }
          : current,
      );
    },
    [pluginId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh, toggle };
}
