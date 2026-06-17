import { ModelProviderType, WorkspaceCredentialType } from '@prisma/client';

// 运行时真实可用的凭证形态。这里包含明文 secret，只允许在后端运行链路中传递。
export interface ResolvedModelCredential {
  type: WorkspaceCredentialType;
  secret: string;
  headerName?: string;
  username?: string;
}

// ModelResolverService 的输出结果，是 AI Gateway 动态调用所需的完整模型配置。
export interface ResolvedModel {
  // 数据库模型来源才会有 workspaceModelId/providerId；legacy-env 来源只保留模型名。
  workspaceModelId?: string;
  providerId?: string;
  providerType: ModelProviderType;
  modelId: string;
  baseUrl: string;
  credential: ResolvedModelCredential;
  capabilities?: Record<string, unknown>;
  // workspace 表示来自设置模块；legacy-env 表示回退到当前环境变量 Provider。
  source: 'workspace' | 'legacy-env';
}

// 运行时解析模型需要的上下文。字段顺序对应解析优先级。
export interface ResolveModelInput {
  workspaceId?: string;
  requestedWorkspaceModelId?: string | null;
  agentWorkspaceModelId?: string | null;
  legacyModelName?: string | null;
}
