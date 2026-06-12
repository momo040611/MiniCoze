-- Add workflow to the unified publish target enum.
ALTER TYPE "PublishTargetType" ADD VALUE IF NOT EXISTS 'WORKFLOW';

-- Store workflow version release notes.
ALTER TABLE "WorkflowVersion" ADD COLUMN IF NOT EXISTS "changelog" TEXT;
