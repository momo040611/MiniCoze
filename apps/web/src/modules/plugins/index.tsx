import { PluginList } from './page/PluginList';
import { PluginDetail } from './page/PluginDetail';
import { ToolCallCard } from './components/ToolCallCard';
import { ToolTestPanel } from './components/ToolTestPanel';

export function PluginsPage() {
  return <PluginList />;
}

export { PluginList, PluginDetail, ToolCallCard, ToolTestPanel };
