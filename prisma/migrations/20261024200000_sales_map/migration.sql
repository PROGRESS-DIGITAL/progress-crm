-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "situation" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "salesStep" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "salesStep" TEXT;

-- Привязываем услуги прайса к шагам планограммы по названию; остальные менеджер привяжет в «Прайсе»
UPDATE "Product" SET "salesStep" = CASE
  WHEN name ILIKE '%лендинг%' OR name ILIKE '%одностранич%' THEN 'landing'
  WHEN name ILIKE '%бизнес%сайт%' THEN 'businessSite'
  WHEN name ILIKE '%корпоратив%' THEN 'corporateSite'
  WHEN name ILIKE '%интернет%магазин%' THEN 'shop'
  WHEN name ILIKE 'сервис%' OR name ILIKE '%разработка сервиса%' THEN 'service'
  WHEN name ILIKE '%паспорт%' OR name ILIKE '%логобук%' THEN 'logoPassport'
  WHEN name ILIKE '%логотип%' THEN 'logo'
  WHEN name ILIKE '%брендбук%' THEN 'brandbook'
  WHEN name ILIKE '%платформ%' THEN 'brandPlatform'
  WHEN name ILIKE '%нейминг%' THEN 'naming'
  WHEN name ILIKE '%исследован%' THEN 'research'
  WHEN name ILIKE '%seo%' THEN 'seo'
  WHEN name ILIKE '%директ%' OR name ILIKE '%контекст%' THEN 'context'
  ELSE NULL
END;

-- Сделки наследуют шаг своей услуги
UPDATE "Deal" d SET "salesStep" = p."salesStep" FROM "Product" p WHERE d."productId" = p.id;
