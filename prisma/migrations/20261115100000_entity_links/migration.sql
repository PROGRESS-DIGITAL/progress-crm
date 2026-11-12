-- CreateTable
CREATE TABLE "EntityLink" (
    "id" TEXT NOT NULL,
    "fromDealId" TEXT,
    "fromEventId" TEXT,
    "toDealId" TEXT,
    "toEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityLink_fromDealId_idx" ON "EntityLink"("fromDealId");

-- CreateIndex
CREATE INDEX "EntityLink_fromEventId_idx" ON "EntityLink"("fromEventId");

-- CreateIndex
CREATE INDEX "EntityLink_toDealId_idx" ON "EntityLink"("toDealId");

-- CreateIndex
CREATE INDEX "EntityLink_toEventId_idx" ON "EntityLink"("toEventId");

-- AddForeignKey
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_fromDealId_fkey" FOREIGN KEY ("fromDealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_fromEventId_fkey" FOREIGN KEY ("fromEventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_toDealId_fkey" FOREIGN KEY ("toDealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_toEventId_fkey" FOREIGN KEY ("toEventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Прежние одиночные связи «создано из» и «связать с задачей» переносим в общую таблицу
INSERT INTO "EntityLink" ("id", "fromDealId", "toDealId", "toEventId", "createdAt")
SELECT gen_random_uuid()::text, "id", "sourceDealId", "sourceEventId", "createdAt"
FROM "Deal" WHERE "sourceDealId" IS NOT NULL OR "sourceEventId" IS NOT NULL;

INSERT INTO "EntityLink" ("id", "fromEventId", "toDealId", "toEventId", "createdAt")
SELECT gen_random_uuid()::text, "id", "sourceDealId", "sourceEventId", "createdAt"
FROM "Event" WHERE "sourceDealId" IS NOT NULL OR "sourceEventId" IS NOT NULL;

INSERT INTO "EntityLink" ("id", "fromEventId", "toEventId", "createdAt")
SELECT gen_random_uuid()::text, e."id", e."taskId", e."createdAt"
FROM "Event" e
WHERE e."taskId" IS NOT NULL AND e."taskId" <> e."id"
  AND NOT EXISTS (SELECT 1 FROM "EntityLink" l WHERE l."fromEventId" = e."id" AND l."toEventId" = e."taskId");

-- DropForeignKey
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_sourceDealId_fkey";

-- DropForeignKey
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_sourceEventId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_sourceDealId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_sourceEventId_fkey";

-- AlterTable
ALTER TABLE "Deal" DROP COLUMN "sourceDealId",
DROP COLUMN "sourceEventId";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "sourceDealId",
DROP COLUMN "sourceEventId";

