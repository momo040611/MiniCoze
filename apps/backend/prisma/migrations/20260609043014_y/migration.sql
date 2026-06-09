-- AlterEnum
ALTER TYPE "MessageRole" ADD VALUE 'TOOL';

-- DropIndex
DROP INDEX "KnowledgeChunkVector_vector_hnsw_idx";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "metadata" JSONB;
