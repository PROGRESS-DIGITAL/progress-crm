-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- У старых сделок дата начала — дата создания
UPDATE "Deal" SET "startDate" = "createdAt";
