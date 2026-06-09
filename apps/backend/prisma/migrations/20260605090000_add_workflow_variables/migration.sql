-- CreateEnum
CREATE TYPE "WorkflowVariableScope" AS ENUM ('SESSION', 'GLOBAL');

-- CreateTable
CREATE TABLE "WorkflowVariable" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scope" "WorkflowVariableScope" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowVariable_workspaceId_scope_scopeKey_idx" ON "WorkflowVariable"("workspaceId", "scope", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVariable_workspaceId_scope_scopeKey_name_key" ON "WorkflowVariable"("workspaceId", "scope", "scopeKey", "name");

-- AddForeignKey
ALTER TABLE "WorkflowVariable" ADD CONSTRAINT "WorkflowVariable_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
