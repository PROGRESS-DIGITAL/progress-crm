-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "sourceDealId" TEXT,
ADD COLUMN     "sourceEventId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "sourceDealId" TEXT,
ADD COLUMN     "sourceEventId" TEXT;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sourceDealId_fkey" FOREIGN KEY ("sourceDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sourceDealId_fkey" FOREIGN KEY ("sourceDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

