
-- CreateTable
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardCard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "columnId" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardColumn_order_idx" ON "BoardColumn"("order");

-- CreateIndex
CREATE INDEX "BoardCard_columnId_position_idx" ON "BoardCard"("columnId", "position");

-- AddForeignKey
ALTER TABLE "BoardCard" ADD CONSTRAINT "BoardCard_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardCard" ADD CONSTRAINT "BoardCard_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Столбцы доски по умолчанию: их можно переименовать, удалить и добавить свои
INSERT INTO "BoardColumn" ("id", "name", "order") VALUES
    ('board_backlog', 'Бэклог', 1),
    ('board_sprint', 'Спринт', 2),
    ('board_progress', 'В работе', 3),
    ('board_release', 'Релиз', 4),
    ('board_bugs', 'Баги', 5);
