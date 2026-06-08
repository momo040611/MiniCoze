-- KnowledgeUploadStage：上传 stage 元数据；文件实体在本地磁盘。
CREATE TABLE "KnowledgeUploadStage" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeUploadStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeUploadStage_fileId_key" ON "KnowledgeUploadStage"("fileId");
CREATE INDEX "KnowledgeUploadStage_uploaderId_idx" ON "KnowledgeUploadStage"("uploaderId");
CREATE INDEX "KnowledgeUploadStage_expiresAt_idx" ON "KnowledgeUploadStage"("expiresAt");

ALTER TABLE "KnowledgeUploadStage"
    ADD CONSTRAINT "KnowledgeUploadStage_uploaderId_fkey"
    FOREIGN KEY ("uploaderId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
