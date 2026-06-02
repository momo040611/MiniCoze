-- CreateEnum
CREATE TYPE "PublishTargetType" AS ENUM ('AGENT');

-- CreateEnum
CREATE TYPE "PublishAction" AS ENUM ('PUBLISH', 'ROLLBACK', 'OFFLINE', 'ENABLE_CHANNEL', 'DISABLE_CHANNEL');

-- CreateEnum
CREATE TYPE "PublishActionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PublishChannelType" AS ENUM ('WEB', 'API');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "currentVersionId" TEXT;

-- CreateTable
CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changelog" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetType" "PublishTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "versionId" TEXT,
    "action" "PublishAction" NOT NULL,
    "status" "PublishActionStatus" NOT NULL,
    "changelog" TEXT,
    "errorMessage" TEXT,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishChannel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetType" "PublishTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "channel" "PublishChannelType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentVersion_agentId_idx" ON "AgentVersion"("agentId");

-- CreateIndex
CREATE INDEX "AgentVersion_createdBy_idx" ON "AgentVersion"("createdBy");

-- CreateIndex
CREATE INDEX "AgentVersion_agentId_publishedAt_idx" ON "AgentVersion"("agentId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentVersion_agentId_version_key" ON "AgentVersion"("agentId", "version");

-- CreateIndex
CREATE INDEX "PublishRecord_workspaceId_idx" ON "PublishRecord"("workspaceId");

-- CreateIndex
CREATE INDEX "PublishRecord_targetType_targetId_idx" ON "PublishRecord"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PublishRecord_versionId_idx" ON "PublishRecord"("versionId");

-- CreateIndex
CREATE INDEX "PublishRecord_operatorId_idx" ON "PublishRecord"("operatorId");

-- CreateIndex
CREATE INDEX "PublishRecord_createdAt_idx" ON "PublishRecord"("createdAt");

-- CreateIndex
CREATE INDEX "PublishChannel_workspaceId_idx" ON "PublishChannel"("workspaceId");

-- CreateIndex
CREATE INDEX "PublishChannel_targetType_targetId_idx" ON "PublishChannel"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PublishChannel_channel_enabled_idx" ON "PublishChannel"("channel", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "PublishChannel_targetType_targetId_channel_key" ON "PublishChannel"("targetType", "targetId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_currentVersionId_key" ON "Agent"("currentVersionId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "AgentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishChannel" ADD CONSTRAINT "PublishChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
