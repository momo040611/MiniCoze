// 工作区成员管理 API — 对接后端 NestJS 成员管理接口

import { http, type ApiEnvelope } from '../http';
import { getCurrentWorkspaceId } from './index';

// ---- 类型定义 ----

export interface WorkspaceMember {
  id: string;
  userId: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: string;
}

// ---- API 方法 ----

/** 获取当前工作区的成员列表 */
export async function getMembers(): Promise<WorkspaceMember[]> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.get<ApiEnvelope<WorkspaceMember[]>>(
    `workspaces/${workspaceId}/members`,
  );
  return res.data ?? [];
}

/** 添加成员（通过邮箱） */
export async function addMember(
  email: string,
  role: 'ADMIN' | 'MEMBER' = 'MEMBER',
): Promise<WorkspaceMember> {
  const workspaceId = await getCurrentWorkspaceId();
  const res = await http.post<ApiEnvelope<WorkspaceMember>>(
    `workspaces/${workspaceId}/members`,
    { email, role },
  );
  return res.data;
}

/** 修改成员角色 */
export async function updateMemberRole(
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER',
): Promise<void> {
  const workspaceId = await getCurrentWorkspaceId();
  await http.patch(
    `workspaces/${workspaceId}/members/${userId}`,
    { role },
  );
}

/** 移除成员 */
export async function removeMember(userId: string): Promise<void> {
  const workspaceId = await getCurrentWorkspaceId();
  await http.delete(`workspaces/${workspaceId}/members/${userId}`);
}
