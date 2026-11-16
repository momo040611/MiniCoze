import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from '../workspace';

export type SearchItemType = 'agent' | 'workflow' | 'knowledge' | 'conversation';

export interface SearchItem {
  id: string;
  type: SearchItemType;
  title: string;
  description: string | null;
  updatedAt: string;
}

export interface SearchResultGroup {
  agents: SearchItem[];
  workflows: SearchItem[];
  knowledgeBases: SearchItem[];
  conversations: SearchItem[];
}

export async function globalSearch(keyword: string): Promise<SearchResultGroup> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<SearchResultGroup>>(
    `workspaces/${workspaceId}/search`,
    { query: { q: keyword } },
  );
  return res.data;
}
