-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'CHAT';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "aiTypingAt" TIMESTAMP(3);

-- Постоянный агент получает право вносить изменения в CRM
UPDATE "Agent" SET "scopes" = array_append("scopes", 'edit') WHERE "isDefault" AND NOT ('edit' = ANY("scopes"));
