-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "priceFrom" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT,
    "service" "Service" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_category_sortOrder_idx" ON "Product"("category", "sortOrder");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Прайс с progrs.ru/price на 21.10.2026
INSERT INTO "Product" ("id", "category", "name", "description", "price", "priceFrom", "unit", "service", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid()::text, 'Сайты', 'Одностраничный сайт (лендинг)', 'Сайт для продажи одного товара, группы товаров или услуги; может быть визиткой компании', 150000, true, NULL, 'WEBSITE', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Сайты', 'Бизнес-сайт', 'Презентационный многостраничный сайт: о компании, услуги, фотогалерея проектов, контакты', 250000, true, NULL, 'WEBSITE', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Сайты', 'Корпоративный сайт', 'Многостраничный сайт: портфолио, география, отзывы партнёров, новости', 300000, true, NULL, 'WEBSITE', 30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Сайты', 'Интернет-магазин', 'Каталог товаров с заказом и оплатой, возможна выгрузка из 1С', 350000, true, NULL, 'WEBSITE', 40, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Сайты', 'Сервис', 'Индивидуальный проект, проектируется вместе с заказчиком', 800000, true, NULL, 'WEBSITE', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Сайты', 'Доработка и наполнение сайта', 'Дополнительные работы по сайту и его наполнению', 3000, true, 'час', 'WEBSITE', 60, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Брендинг', 'Логотип', 'Разработка знака компании', 80000, false, NULL, 'BRANDING', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Брендинг', 'Логобук', 'Правила использования логотипа, базовая часть брендбука', 100000, false, NULL, 'BRANDING', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Брендинг', 'Брендбук', 'Руководство по использованию бренда и фирменного стиля', 250000, true, NULL, 'BRANDING', 30, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Издания', 'Презентация / маркетинг-кит', 'Презентации, маркетинг-киты, годовые отчёты, буклеты, каталоги', 5000, true, 'страница', 'OTHER', 10, CURRENT_TIMESTAMP);
