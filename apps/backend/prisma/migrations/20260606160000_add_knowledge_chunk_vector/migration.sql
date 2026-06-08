-- Enable pgvector. The pgvector/pgvector:pg16 image provides this extension.
CREATE EXTENSION IF NOT EXISTS vector;

-- KnowledgeChunkVector stores chunk embeddings separately so the embedding model
-- can be changed without changing the chunk record itself.
CREATE TABLE "KnowledgeChunkVector" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "embedderModel" TEXT NOT NULL,
    "dim" INTEGER NOT NULL,
    "vector" vector(1024) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunkVector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeChunkVector_chunkId_key" ON "KnowledgeChunkVector"("chunkId");

INSERT INTO "KnowledgeChunkVector" (
    "id",
    "chunkId",
    "embedderModel",
    "dim",
    "vector",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_chunk_vector_' || md5(c."id"),
    c."id",
    kb."embeddingModel",
    kb."embeddingDim",
    c."embedding",
    c."createdAt",
    c."updatedAt"
FROM "KnowledgeChunk" c
JOIN "KnowledgeBase" kb ON kb."id" = c."knowledgeBaseId"
ON CONFLICT ("chunkId") DO NOTHING;

CREATE INDEX "KnowledgeChunkVector_vector_hnsw_idx"
    ON "KnowledgeChunkVector"
    USING hnsw ("vector" vector_cosine_ops);

ALTER TABLE "KnowledgeChunkVector"
    ADD CONSTRAINT "KnowledgeChunkVector_chunkId_fkey"
    FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "KnowledgeChunk_embedding_hnsw_idx";

ALTER TABLE "KnowledgeChunk" DROP COLUMN "embedding";

ALTER TABLE "KnowledgeBase"
    DROP COLUMN "embeddingModel",
    DROP COLUMN "embeddingDim";
