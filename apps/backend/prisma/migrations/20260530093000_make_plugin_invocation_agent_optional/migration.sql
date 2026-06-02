-- DropForeignKey
ALTER TABLE "PluginInvocation" DROP CONSTRAINT "PluginInvocation_agentId_fkey";

-- AlterTable
ALTER TABLE "PluginInvocation" ALTER COLUMN "agentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PluginInvocation" ADD CONSTRAINT "PluginInvocation_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
