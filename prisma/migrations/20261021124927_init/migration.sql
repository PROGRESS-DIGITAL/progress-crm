-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "Service" AS ENUM ('WEBSITE', 'SEO', 'CONTEXT_ADS', 'BRANDING', 'SMM', 'OTHER');

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "StageKind" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "service" "Service" NOT NULL DEFAULT 'WEBSITE',
    "owner" TEXT,
    "expectedCloseDate" TIMESTAMP(3),
    "lostReason" TEXT,
    "notes" TEXT,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stage_order_key" ON "Stage"("order");

-- CreateIndex
CREATE INDEX "Deal_stageId_position_idx" ON "Deal"("stageId", "position");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
