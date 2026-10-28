-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "aiCheckedAt" TIMESTAMP(3),
ADD COLUMN     "aiEnabled" BOOLEAN,
ADD COLUMN     "aiError" TEXT,
ADD COLUMN     "aiHandoff" TEXT,
ADD COLUMN     "aiHandoffAt" TIMESTAMP(3);
