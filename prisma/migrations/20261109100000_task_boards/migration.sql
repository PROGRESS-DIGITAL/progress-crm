-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "columnId" TEXT,
ADD COLUMN     "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "main" BOOLEAN NOT NULL DEFAULT false,
    "order" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventComment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Board_order_idx" ON "Board"("order");

-- CreateIndex
CREATE INDEX "BoardColumn_boardId_order_idx" ON "BoardColumn"("boardId", "order");

-- CreateIndex
CREATE INDEX "EventComment_eventId_createdAt_idx" ON "EventComment"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_columnId_position_idx" ON "Event"("columnId", "position");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardColumn" ADD CONSTRAINT "BoardColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Основная доска для задач из календаря, ИИ-агентов и списка задач, и доска команды
INSERT INTO "Board" ("id", "name", "main", "order") VALUES
  ('board_main', 'Основная', true, 1),
  ('board_team', 'Команда', false, 2);

INSERT INTO "BoardColumn" ("id", "boardId", "name", "order") VALUES
  ('main_todo', 'board_main', 'К выполнению', 1),
  ('main_progress', 'board_main', 'В работе', 2),
  ('main_review', 'board_main', 'На проверке', 3),
  ('board_backlog', 'board_team', 'Бэклог', 1),
  ('board_sprint', 'board_team', 'Спринт', 2),
  ('board_progress', 'board_team', 'В работе', 3),
  ('board_release', 'board_team', 'Релиз', 4),
  ('board_bugs', 'board_team', 'Баги', 5);
