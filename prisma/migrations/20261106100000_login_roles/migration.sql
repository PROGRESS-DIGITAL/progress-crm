-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failedLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "login" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sections" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "codeHash" TEXT,
    "codeExpires" TIMESTAMP(3),
    "codeTries" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginEvent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "login" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_employeeId_idx" ON "Session"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_tokenHash_key" ON "TrustedDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "TrustedDevice_employeeId_idx" ON "TrustedDevice"("employeeId");

-- CreateIndex
CREATE INDEX "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_login_key" ON "Employee"("login");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Роли по умолчанию; директор (Employee.isOwner) видит всё без роли
INSERT INTO "Role" ("id", "name", "sections") VALUES
  ('role_manager', 'Менеджер', ARRAY['deals', 'leads', 'clients', 'chats', 'mail', 'calendar', 'tasks', 'price', 'documents']),
  ('role_designer', 'Дизайнер', ARRAY['tasks', 'calendar', 'clients']),
  ('role_developer', 'Разработчик', ARRAY['tasks', 'calendar', 'clients']);

-- Чаты с AI агентом принадлежат сотруднику, который их начал
ALTER TABLE "AgentChat" ADD COLUMN     "employeeId" TEXT;
ALTER TABLE "AgentChat" ADD CONSTRAINT "AgentChat_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
