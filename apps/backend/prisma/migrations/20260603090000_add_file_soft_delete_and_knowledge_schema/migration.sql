-- AlterEnum
ALTER TYPE "FilePurpose" RENAME TO "FilePurpose_old";

CREATE TYPE "FilePurpose" AS ENUM (
    'USER_AVATAR',
    'WORKSPACE_AVATAR',
    'AGENT_AVATAR',
    'PLUGIN_ICON',
    'KNOWLEDGE_DOCUMENT',
    'CHAT_ATTACHMENT',
    'WORKFLOW_ATTACHMENT',
    'TEMP_UPLOAD'
);

ALTER TABLE "FileAsset" ALTER COLUMN "purpose" TYPE "FilePurpose" USING (
    CASE "purpose"::text
        WHEN 'AVATAR' THEN 'USER_AVATAR'
        ELSE "purpose"::text
    END
)::"FilePurpose";

DROP TYPE "FilePurpose_old";

-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "KnowledgeBaseStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PARSED', 'CHUNKED', 'EMBEDDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "vectorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseAgentBinding" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseAgentBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileAsset_workspaceId_purpose_idx" ON "FileAsset"("workspaceId", "purpose");

-- CreateIndex
CREATE INDEX "FileAsset_workspaceId_status_idx" ON "FileAsset"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "FileAsset_workspaceId_checksum_idx" ON "FileAsset"("workspaceId", "checksum");

-- CreateIndex
CREATE INDEX "FileAsset_ownerId_createdAt_idx" ON "FileAsset"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "FileAsset_createdAt_idx" ON "FileAsset"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeBase_workspaceId_idx" ON "KnowledgeBase"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeBase_creatorId_idx" ON "KnowledgeBase"("creatorId");

-- CreateIndex
CREATE INDEX "KnowledgeBase_workspaceId_status_idx" ON "KnowledgeBase"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_knowledgeBaseId_idx" ON "KnowledgeDocument"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_workspaceId_idx" ON "KnowledgeDocument"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_fileId_idx" ON "KnowledgeDocument"("fileId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_creatorId_idx" ON "KnowledgeDocument"("creatorId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_knowledgeBaseId_fileId_key" ON "KnowledgeDocument"("knowledgeBaseId", "fileId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_knowledgeBaseId_idx" ON "KnowledgeChunk"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_workspaceId_idx" ON "KnowledgeChunk"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_vectorId_idx" ON "KnowledgeChunk"("vectorId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_index_key" ON "KnowledgeChunk"("documentId", "index");

-- CreateIndex
CREATE INDEX "KnowledgeBaseAgentBinding_agentId_idx" ON "KnowledgeBaseAgentBinding"("agentId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseAgentBinding_knowledgeBaseId_idx" ON "KnowledgeBaseAgentBinding"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseAgentBinding_agentId_enabled_idx" ON "KnowledgeBaseAgentBinding"("agentId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseAgentBinding_agentId_knowledgeBaseId_key" ON "KnowledgeBaseAgentBinding"("agentId", "knowledgeBaseId");

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseAgentBinding" ADD CONSTRAINT "KnowledgeBaseAgentBinding_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseAgentBinding" ADD CONSTRAINT "KnowledgeBaseAgentBinding_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
