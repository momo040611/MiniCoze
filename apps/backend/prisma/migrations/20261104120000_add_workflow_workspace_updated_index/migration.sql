-- 工作流列表按 updatedAt 倒序分页：让索引直接提供顺序，消掉 Sort
CREATE INDEX "Workflow_workspaceId_updatedAt_idx"
  ON "Workflow" ("workspaceId", "updatedAt" DESC);
