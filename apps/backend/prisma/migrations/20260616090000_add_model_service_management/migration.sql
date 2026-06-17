-- 模型服务管理新增枚举：凭证状态、凭证类型、Provider 类型、连接测试状态。
-- CreateEnum
CREATE TYPE "WorkspaceCredentialStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WorkspaceCredentialType" AS ENUM ('BEARER_TOKEN', 'API_KEY_HEADER', 'BASIC_AUTH');

-- CreateEnum
CREATE TYPE "ModelProviderType" AS ENUM ('OPENAI', 'DEEPSEEK', 'OPENAI_COMPATIBLE');

-- CreateEnum
CREATE TYPE "ModelConnectionStatus" AS ENUM ('UNTESTED', 'AVAILABLE', 'UNAVAILABLE');

-- Agent 保留旧 model 字符串，同时新增可空 workspaceModelId 支持新模型管理链路。
-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "workspaceModelId" TEXT;

-- 工作区通用凭证表：只存密文和掩码，明文由后端运行时解密。
-- CreateTable
CREATE TABLE "WorkspaceCredential" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkspaceCredentialType" NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "maskedHint" TEXT NOT NULL,
    "config" JSONB,
    "status" "WorkspaceCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCredential_pkey" PRIMARY KEY ("id")
);

-- 工作区模型服务表：描述 Provider 类型、Base URL 和使用的凭证。
-- CreateTable
CREATE TABLE "WorkspaceModelProvider" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" "ModelProviderType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "connectionStatus" "ModelConnectionStatus" NOT NULL DEFAULT 'UNTESTED',
    "lastTestMessage" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceModelProvider_pkey" PRIMARY KEY ("id")
);

-- 工作区模型表：一个 Provider 下可以配置多个实际 modelId。
-- CreateTable
CREATE TABLE "WorkspaceModel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "capabilities" JSONB,
    "contextWindow" INTEGER,
    "maxOutputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceModel_pkey" PRIMARY KEY ("id")
);

-- 工作区运行设置表：默认模型统一存这里，不在 WorkspaceModel 上维护 isDefault。
-- CreateTable
CREATE TABLE "WorkspaceRuntimeSetting" (
    "workspaceId" TEXT NOT NULL,
    "defaultModelId" TEXT,
    "defaultTemperature" DOUBLE PRECISION,
    "defaultMaxTokens" INTEGER,
    "defaultContextLimit" INTEGER,
    "requestTimeoutMs" INTEGER,
    "maxToolRounds" INTEGER,
    "maxRunDurationMs" INTEGER,
    "retryCount" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceRuntimeSetting_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceCredential_workspaceId_name_key" ON "WorkspaceCredential"("workspaceId", "name");
CREATE INDEX "WorkspaceCredential_workspaceId_idx" ON "WorkspaceCredential"("workspaceId");
CREATE INDEX "WorkspaceCredential_createdBy_idx" ON "WorkspaceCredential"("createdBy");
CREATE INDEX "WorkspaceCredential_workspaceId_status_idx" ON "WorkspaceCredential"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceModelProvider_workspaceId_name_key" ON "WorkspaceModelProvider"("workspaceId", "name");
CREATE INDEX "WorkspaceModelProvider_workspaceId_idx" ON "WorkspaceModelProvider"("workspaceId");
CREATE INDEX "WorkspaceModelProvider_credentialId_idx" ON "WorkspaceModelProvider"("credentialId");
CREATE INDEX "WorkspaceModelProvider_createdBy_idx" ON "WorkspaceModelProvider"("createdBy");
CREATE INDEX "WorkspaceModelProvider_workspaceId_enabled_idx" ON "WorkspaceModelProvider"("workspaceId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceModel_providerId_modelId_key" ON "WorkspaceModel"("providerId", "modelId");
CREATE INDEX "WorkspaceModel_workspaceId_idx" ON "WorkspaceModel"("workspaceId");
CREATE INDEX "WorkspaceModel_providerId_idx" ON "WorkspaceModel"("providerId");
CREATE INDEX "WorkspaceModel_workspaceId_enabled_idx" ON "WorkspaceModel"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "WorkspaceRuntimeSetting_defaultModelId_idx" ON "WorkspaceRuntimeSetting"("defaultModelId");
CREATE INDEX "Agent_workspaceModelId_idx" ON "Agent"("workspaceModelId");

-- 外键约束：工作区删除时清理配置；凭证被 Provider 使用时禁止直接删除；
-- Agent 指向的模型删除后置空，保留旧 model 字符串作为兜底。
-- AddForeignKey
ALTER TABLE "WorkspaceCredential" ADD CONSTRAINT "WorkspaceCredential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceCredential" ADD CONSTRAINT "WorkspaceCredential_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceModelProvider" ADD CONSTRAINT "WorkspaceModelProvider_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceModelProvider" ADD CONSTRAINT "WorkspaceModelProvider_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "WorkspaceCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceModelProvider" ADD CONSTRAINT "WorkspaceModelProvider_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceModel" ADD CONSTRAINT "WorkspaceModel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceModel" ADD CONSTRAINT "WorkspaceModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "WorkspaceModelProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRuntimeSetting" ADD CONSTRAINT "WorkspaceRuntimeSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRuntimeSetting" ADD CONSTRAINT "WorkspaceRuntimeSetting_defaultModelId_fkey" FOREIGN KEY ("defaultModelId") REFERENCES "WorkspaceModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_workspaceModelId_fkey" FOREIGN KEY ("workspaceModelId") REFERENCES "WorkspaceModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
