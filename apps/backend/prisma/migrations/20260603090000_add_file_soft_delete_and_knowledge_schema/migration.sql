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

-- KnowledgeBase was created by 20260528100000_add_knowledge_rag. Extend it to the
-- current schema instead of creating it again.
ALTER TABLE "KnowledgeBase"
    ADD COLUMN "status" "KnowledgeBaseStatus" NOT NULL DEFAULT 'ACTIVE';

-- KnowledgeDocument: migrate the initial RAG document shape to the file-backed
-- document schema.
ALTER TABLE "KnowledgeDocument" RENAME COLUMN "originalName" TO "name";

ALTER TABLE "KnowledgeDocument"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "fileId" TEXT,
    ADD COLUMN "creatorId" TEXT,
    ADD COLUMN "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    ADD COLUMN "errorMessage" TEXT,
    ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "tokenCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "KnowledgeDocument" d
SET
    "workspaceId" = kb."workspaceId",
    "creatorId" = kb."creatorId",
    "chunkCount" = d."totalChunks",
    "updatedAt" = d."createdAt"
FROM "KnowledgeBase" kb
WHERE d."knowledgeBaseId" = kb."id";

INSERT INTO "FileAsset" (
    "id",
    "workspaceId",
    "ownerId",
    "purpose",
    "visibility",
    "status",
    "originalName",
    "storageKey",
    "url",
    "mimeType",
    "extension",
    "size",
    "checksum",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_knowledge_file_' || md5(d."id"),
    d."workspaceId",
    d."creatorId",
    'KNOWLEDGE_DOCUMENT'::"FilePurpose",
    'PRIVATE'::"FileVisibility",
    'READY'::"FileStatus",
    d."name",
    'legacy-knowledge/' || d."id",
    NULL,
    'application/octet-stream',
    d."fileExtension",
    d."fileSize",
    NULL,
    d."createdAt",
    d."updatedAt"
FROM "KnowledgeDocument" d
WHERE d."fileId" IS NULL;

UPDATE "KnowledgeDocument"
SET "fileId" = 'legacy_knowledge_file_' || md5("id")
WHERE "fileId" IS NULL;

ALTER TABLE "KnowledgeDocument"
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "fileId" SET NOT NULL,
    ALTER COLUMN "creatorId" SET NOT NULL,
    ALTER COLUMN "updatedAt" SET NOT NULL,
    ALTER COLUMN "chunkType" DROP NOT NULL,
    ALTER COLUMN "chunkConfig" DROP NOT NULL,
    ALTER COLUMN "totalChars" SET DEFAULT 0,
    DROP COLUMN "fileExtension",
    DROP COLUMN "fileSize",
    DROP COLUMN "totalChunks";

DROP INDEX IF EXISTS "KnowledgeDocument_knowledgeBaseId_createdAt_idx";

-- KnowledgeChunk: keep the old embedding column until
-- 20260606160000_add_knowledge_chunk_vector moves it to KnowledgeChunkVector.
ALTER TABLE "KnowledgeChunk" RENAME COLUMN "chunkIndex" TO "index";

ALTER TABLE "KnowledgeChunk"
    ADD COLUMN "knowledgeBaseId" TEXT,
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "tokenCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "metadata" JSONB,
    ADD COLUMN "vectorId" TEXT,
    ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "KnowledgeChunk" c
SET
    "knowledgeBaseId" = d."knowledgeBaseId",
    "workspaceId" = d."workspaceId",
    "tokenCount" = c."charCount",
    "updatedAt" = c."createdAt"
FROM "KnowledgeDocument" d
WHERE c."documentId" = d."id";

ALTER TABLE "KnowledgeChunk"
    ALTER COLUMN "knowledgeBaseId" SET NOT NULL,
    ALTER COLUMN "workspaceId" SET NOT NULL,
    ALTER COLUMN "updatedAt" SET NOT NULL,
    DROP COLUMN "charCount";

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
CREATE INDEX "KnowledgeBase_workspaceId_status_idx" ON "KnowledgeBase"("workspaceId", "status");

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
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseAgentBinding" ADD CONSTRAINT "KnowledgeBaseAgentBinding_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseAgentBinding" ADD CONSTRAINT "KnowledgeBaseAgentBinding_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
