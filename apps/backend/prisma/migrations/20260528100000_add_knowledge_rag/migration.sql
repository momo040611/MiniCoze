-- 启用 pgvector 扩展（pgvector/pgvector:pg16 镜像自带）。
CREATE EXTENSION IF NOT EXISTS vector;

-- KnowledgeBase
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "embeddingModel" TEXT NOT NULL,
    "embeddingDim" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeBase_workspaceId_idx" ON "KnowledgeBase"("workspaceId");
CREATE INDEX "KnowledgeBase_creatorId_idx" ON "KnowledgeBase"("creatorId");

ALTER TABLE "KnowledgeBase"
    ADD CONSTRAINT "KnowledgeBase_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeBase"
    ADD CONSTRAINT "KnowledgeBase_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- KnowledgeDocument
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "chunkType" TEXT NOT NULL,
    "chunkConfig" JSONB NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "totalChars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeDocument_knowledgeBaseId_idx" ON "KnowledgeDocument"("knowledgeBaseId");
CREATE INDEX "KnowledgeDocument_knowledgeBaseId_createdAt_idx" ON "KnowledgeDocument"("knowledgeBaseId", "createdAt");

ALTER TABLE "KnowledgeDocument"
    ADD CONSTRAINT "KnowledgeDocument_knowledgeBaseId_fkey"
    FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- KnowledgeChunk
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- HNSW 索引使用余弦距离运算符类，与 bge-large-zh-v1.5 归一化向量配合最佳。
CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"
    ON "KnowledgeChunk"
    USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
