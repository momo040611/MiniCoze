-- 启用 pgvector 扩展（pgvector/pgvector:pg16 镜像自带）。
CREATE EXTENSION IF NOT EXISTS vector;

-- KnowledgeChunkVector：单独存放 chunk 向量，便于换模型识别与回填。
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

-- HNSW 索引使用余弦距离运算符类，与归一化的 embedding 输出配合最佳。
CREATE INDEX "KnowledgeChunkVector_vector_hnsw_idx"
    ON "KnowledgeChunkVector"
    USING hnsw ("vector" vector_cosine_ops);

ALTER TABLE "KnowledgeChunkVector"
    ADD CONSTRAINT "KnowledgeChunkVector_chunkId_fkey"
    FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
