-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inn" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Deal" ADD COLUMN "companyId" TEXT,
ADD COLUMN "contactId" TEXT;

-- Перенос данных: одна компания на каждое уникальное имя клиента в сделках
INSERT INTO "Company" ("id", "name", "updatedAt")
SELECT gen_random_uuid()::text, n.name, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT trim("clientName") AS name FROM "Deal") n;

UPDATE "Deal" d SET "companyId" = c."id"
FROM "Company" c WHERE c."name" = trim(d."clientName");

-- Контакт сделки становится контактом компании (по одному на сделку, где он был указан)
INSERT INTO "Contact" ("id", "fullName", "phone", "email", "companyId", "updatedAt")
SELECT gen_random_uuid()::text, coalesce(nullif(trim(d."contactName"), ''), 'Контакт'), d."phone", d."email", d."companyId", CURRENT_TIMESTAMP
FROM "Deal" d
WHERE coalesce(d."contactName", d."phone", d."email") IS NOT NULL;

UPDATE "Deal" d SET "contactId" = ct."id"
FROM "Contact" ct
WHERE ct."companyId" = d."companyId"
  AND ct."fullName" = coalesce(nullif(trim(d."contactName"), ''), 'Контакт')
  AND ct."phone" IS NOT DISTINCT FROM d."phone"
  AND ct."email" IS NOT DISTINCT FROM d."email";

ALTER TABLE "Deal" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Deal" DROP COLUMN "clientName",
DROP COLUMN "contactName",
DROP COLUMN "email",
DROP COLUMN "phone";

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Deal_companyId_idx" ON "Deal"("companyId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
