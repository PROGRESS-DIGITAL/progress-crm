-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "closedAt" TIMESTAMP(3);


-- Уже закрытым сделкам ставим дату последнего изменения: точнее данных нет
UPDATE "Deal" d SET "closedAt" = d."updatedAt" FROM "Stage" s WHERE d."stageId" = s.id AND s.kind <> 'OPEN';
