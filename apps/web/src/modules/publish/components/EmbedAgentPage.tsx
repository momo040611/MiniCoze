// iframe 嵌入页 — /embed/agents/:slug
// 复用公开分享聊天页，嵌入模式下隐藏分享按钮，供外部站点 <iframe> 引用。

import { SharePage } from './SharePage';

export function EmbedAgentPage() {
  return <SharePage embedded />;
}
