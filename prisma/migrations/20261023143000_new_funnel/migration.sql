-- Новая воронка: без «Переговоров», «Договор» → «Подготовка документов», «Выиграна» → «Оплачен»,
-- плюс «Счет на оплату», «В работе», «Релиз и финальный счет». На пустой базе ничего не делает: этапы создаст сид.

-- Сделки из «Переговоров» переезжают в следующий этап
UPDATE "Deal" SET "stageId" = (SELECT "id" FROM "Stage" WHERE "name" = 'Договор')
WHERE "stageId" IN (SELECT "id" FROM "Stage" WHERE "name" = 'Переговоры')
  AND EXISTS (SELECT 1 FROM "Stage" WHERE "name" = 'Договор');
DELETE FROM "Stage" WHERE "name" = 'Переговоры' AND NOT EXISTS (SELECT 1 FROM "Deal" d WHERE d."stageId" = "Stage"."id");

UPDATE "Stage" SET "name" = 'Подготовка документов' WHERE "name" = 'Договор';
UPDATE "Stage" SET "name" = 'Оплачен' WHERE "name" = 'Выиграна';

-- Сдвигаем порядок, чтобы не упереться в уникальность "order"
UPDATE "Stage" SET "order" = "order" + 1000;

INSERT INTO "Stage" ("id", "name", "order", "kind")
SELECT gen_random_uuid()::text, n.name, n.ord, 'OPEN'
FROM (VALUES ('Счет на оплату', 2004), ('В работе', 2005), ('Релиз и финальный счет', 2006)) AS n(name, ord)
WHERE EXISTS (SELECT 1 FROM "Stage")
  AND NOT EXISTS (SELECT 1 FROM "Stage" s WHERE s."name" = n.name);

UPDATE "Stage" SET "order" = CASE "name"
  WHEN 'Новая' THEN 0
  WHEN 'Квалификация' THEN 1
  WHEN 'КП отправлено' THEN 2
  WHEN 'Подготовка документов' THEN 3
  WHEN 'Счет на оплату' THEN 4
  WHEN 'В работе' THEN 5
  WHEN 'Релиз и финальный счет' THEN 6
  WHEN 'Оплачен' THEN 7
  WHEN 'Проиграна' THEN 8
END
WHERE "name" IN ('Новая', 'Квалификация', 'КП отправлено', 'Подготовка документов', 'Счет на оплату',
                 'В работе', 'Релиз и финальный счет', 'Оплачен', 'Проиграна');

-- Этапы, переименованные вручную, встают в конец в прежнем порядке
UPDATE "Stage" s SET "order" = 9 + r.rn
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "order") - 1 AS rn FROM "Stage" WHERE "order" >= 1000) r
WHERE s."id" = r."id";
