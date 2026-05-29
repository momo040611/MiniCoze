-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkflowRunSource" AS ENUM ('DEBUG', 'AGENT', 'API');

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "graph" JSONB NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "description" TEXT,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentWorkflow" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersionId" TEXT,
    "agentId" TEXT,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "source" "WorkflowRunSource" NOT NULL DEFAULT 'DEBUG',
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_idx" ON "Workflow"("workspaceId");

-- CreateIndex
CREATE INDEX "Workflow_creatorId_idx" ON "Workflow"("creatorId");

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_status_idx" ON "Workflow"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Workflow_publishedVersionId_idx" ON "Workflow"("publishedVersionId");

-- CreateIndex
CREATE INDEX "WorkflowVersion_workflowId_idx" ON "WorkflowVersion"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowVersion_createdBy_idx" ON "WorkflowVersion"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowId_version_key" ON "WorkflowVersion"("workflowId", "version");

-- CreateIndex
CREATE INDEX "AgentWorkflow_agentId_idx" ON "AgentWorkflow"("agentId");

-- CreateIndex
CREATE INDEX "AgentWorkflow_workflowId_idx" ON "AgentWorkflow"("workflowId");

-- CreateIndex
CREATE INDEX "AgentWorkflow_workflowVersionId_idx" ON "AgentWorkflow"("workflowVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWorkflow_agentId_workflowId_key" ON "AgentWorkflow"("agentId", "workflowId");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_idx" ON "WorkflowRun"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowVersionId_idx" ON "WorkflowRun"("workflowVersionId");

-- CreateIndex
CREATE INDEX "WorkflowRun_agentId_idx" ON "WorkflowRun"("agentId");

-- CreateIndex
CREATE INDEX "WorkflowRun_userId_idx" ON "WorkflowRun"("userId");

-- CreateIndex
CREATE INDEX "WorkflowRun_conversationId_idx" ON "WorkflowRun"("conversationId");

-- CreateIndex
CREATE INDEX "WorkflowRun_messageId_idx" ON "WorkflowRun"("messageId");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_idx" ON "WorkflowRun"("status");

-- CreateIndex
CREATE INDEX "WorkflowRun_source_idx" ON "WorkflowRun"("source");

-- CreateIndex
CREATE INDEX "WorkflowRun_startedAt_idx" ON "WorkflowRun"("startedAt");

-- CreateIndex
CREATE INDEX "WorkflowRunStep_runId_idx" ON "WorkflowRunStep"("runId");

-- CreateIndex
CREATE INDEX "WorkflowRunStep_nodeId_idx" ON "WorkflowRunStep"("nodeId");

-- CreateIndex
CREATE INDEX "WorkflowRunStep_nodeType_idx" ON "WorkflowRunStep"("nodeType");

-- CreateIndex
CREATE INDEX "WorkflowRunStep_status_idx" ON "WorkflowRunStep"("status");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWorkflow" ADD CONSTRAINT "AgentWorkflow_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWorkflow" ADD CONSTRAINT "AgentWorkflow_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWorkflow" ADD CONSTRAINT "AgentWorkflow_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRunStep" ADD CONSTRAINT "WorkflowRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
