-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "director" TEXT,
ADD COLUMN     "kpp" TEXT,
ADD COLUMN     "ogrn" TEXT;

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

