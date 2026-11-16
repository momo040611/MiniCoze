-- 长期记忆 v1：会话摘要字段
ALTER TABLE "Conversation" ADD COLUMN "memorySummary" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "memorySummaryCount" INTEGER NOT NULL DEFAULT 0;
