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

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN "agentId" TEXT;
ALTER TABLE "WorkflowRun" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "WorkflowRun" ADD COLUMN "messageId" TEXT;

-- CreateIndex
CREATE INDEX "AgentWorkflow_agentId_idx" ON "AgentWorkflow"("agentId");

-- CreateIndex
CREATE INDEX "AgentWorkflow_workflowId_idx" ON "AgentWorkflow"("workflowId");

-- CreateIndex
CREATE INDEX "AgentWorkflow_workflowVersionId_idx" ON "AgentWorkflow"("workflowVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentWorkflow_agentId_workflowId_key" ON "AgentWorkflow"("agentId", "workflowId");

-- CreateIndex
CREATE INDEX "WorkflowRun_agentId_idx" ON "WorkflowRun"("agentId");

-- CreateIndex
CREATE INDEX "WorkflowRun_conversationId_idx" ON "WorkflowRun"("conversationId");

-- CreateIndex
CREATE INDEX "WorkflowRun_messageId_idx" ON "WorkflowRun"("messageId");

-- AddForeignKey
ALTER TABLE "AgentWorkflow" ADD CONSTRAINT "AgentWorkflow_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWorkflow" ADD CONSTRAINT "AgentWorkflow_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentWorkflow" ADD CONSTRAINT "AgentWorkflow_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
