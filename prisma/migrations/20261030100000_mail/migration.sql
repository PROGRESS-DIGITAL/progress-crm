-- CreateEnum
CREATE TYPE "MailProvider" AS ENUM ('GMAIL', 'YANDEX');

-- CreateEnum
CREATE TYPE "MailFolder" AS ENUM ('INBOX', 'SENT');

-- CreateTable
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL,
    "provider" "MailProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "inboxUid" INTEGER NOT NULL DEFAULT 0,
    "inboxValidity" TEXT,
    "sentUid" INTEGER NOT NULL DEFAULT 0,
    "sentValidity" TEXT,
    "syncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "folder" "MailFolder" NOT NULL,
    "uid" INTEGER,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "to" TEXT NOT NULL,
    "cc" TEXT,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT,
    "snippet" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "cid" TEXT,
    "data" BYTEA NOT NULL,

    CONSTRAINT "MailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailAccount_email_key" ON "MailAccount"("email");

-- CreateIndex
CREATE INDEX "MailMessage_accountId_folder_date_idx" ON "MailMessage"("accountId", "folder", "date");

-- CreateIndex
CREATE INDEX "MailMessage_companyId_date_idx" ON "MailMessage"("companyId", "date");

-- CreateIndex
CREATE INDEX "MailMessage_messageId_idx" ON "MailMessage"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_accountId_folder_uid_key" ON "MailMessage"("accountId", "folder", "uid");

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

