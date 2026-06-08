-- AlterEnum
ALTER TYPE "PublishAction" ADD VALUE 'UPDATE_CHANNEL';
ALTER TYPE "PublishAction" ADD VALUE 'ROTATE_API_KEY';

-- AlterTable
ALTER TABLE "PublishRecord" ADD COLUMN "versionNumber" INTEGER;
