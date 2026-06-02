-- CreateEnum
CREATE TYPE "PluginType" AS ENUM ('BUILTIN', 'HTTP');

-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PluginToolStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AgentPluginBindingStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "PluginInvocationStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELED');

-- CreateEnum
CREATE TYPE "PluginCredentialStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "PluginDefinition" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "type" "PluginType" NOT NULL,
    "status" "PluginStatus" NOT NULL DEFAULT 'DRAFT',
    "version" TEXT NOT NULL DEFAULT 'v1.0.0',
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "maskStrategy" JSONB,
    "invocationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginTool" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PluginToolStatus" NOT NULL DEFAULT 'ACTIVE',
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPluginBinding" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "status" "AgentPluginBindingStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoInvoke" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPluginBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginCredential" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PluginCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "authType" TEXT NOT NULL,
    "secretEncrypted" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginInvocation" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "runId" TEXT NOT NULL,
    "toolCode" TEXT NOT NULL,
    "status" "PluginInvocationStatus" NOT NULL,
    "argsSummary" JSONB,
    "outputSummary" JSONB,
    "errorSummary" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PluginInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PluginDefinition_workspaceId_status_idx" ON "PluginDefinition"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PluginDefinition_workspaceId_type_idx" ON "PluginDefinition"("workspaceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PluginDefinition_workspaceId_code_key" ON "PluginDefinition"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "PluginTool_pluginId_status_idx" ON "PluginTool"("pluginId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PluginTool_pluginId_code_key" ON "PluginTool"("pluginId", "code");

-- CreateIndex
CREATE INDEX "AgentPluginBinding_agentId_status_idx" ON "AgentPluginBinding"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentPluginBinding_pluginId_status_idx" ON "AgentPluginBinding"("pluginId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPluginBinding_agentId_pluginId_key" ON "AgentPluginBinding"("agentId", "pluginId");

-- CreateIndex
CREATE INDEX "PluginCredential_pluginId_workspaceId_status_idx" ON "PluginCredential"("pluginId", "workspaceId", "status");

-- CreateIndex
CREATE INDEX "PluginInvocation_pluginId_startedAt_idx" ON "PluginInvocation"("pluginId", "startedAt");

-- CreateIndex
CREATE INDEX "PluginInvocation_agentId_startedAt_idx" ON "PluginInvocation"("agentId", "startedAt");

-- CreateIndex
CREATE INDEX "PluginInvocation_runId_idx" ON "PluginInvocation"("runId");

-- AddForeignKey
ALTER TABLE "PluginDefinition" ADD CONSTRAINT "PluginDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginDefinition" ADD CONSTRAINT "PluginDefinition_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginTool" ADD CONSTRAINT "PluginTool_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "PluginDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPluginBinding" ADD CONSTRAINT "AgentPluginBinding_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPluginBinding" ADD CONSTRAINT "AgentPluginBinding_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "PluginDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginCredential" ADD CONSTRAINT "PluginCredential_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "PluginDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginCredential" ADD CONSTRAINT "PluginCredential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginInvocation" ADD CONSTRAINT "PluginInvocation_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "PluginDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginInvocation" ADD CONSTRAINT "PluginInvocation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
