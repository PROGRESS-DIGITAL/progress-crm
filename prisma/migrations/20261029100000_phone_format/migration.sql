-- Телефоны в едином виде +7 (968) 111-11-11. Российские номера: 11 цифр с 7 или 8 либо 10 цифр без кода страны;
-- иностранные (+ и не 7) и неполные не трогаем
UPDATE "Company" SET "phone" = '+7 (' || substr(t.n, 1, 3) || ') ' || substr(t.n, 4, 3) || '-' || substr(t.n, 7, 2) || '-' || substr(t.n, 9, 2)
FROM (
  SELECT "id", CASE
    WHEN length(d) = 11 AND left(d, 1) IN ('7', '8') THEN substr(d, 2)
    WHEN length(d) = 10 THEN d
  END AS n
  FROM (SELECT "id", regexp_replace("phone", '\D', '', 'g') AS d FROM "Company" WHERE "phone" IS NOT NULL AND "phone" !~ '^\s*\+[^7]') AS x
) AS t
WHERE "Company"."id" = t."id" AND t.n IS NOT NULL;

UPDATE "Contact" SET "phone" = '+7 (' || substr(t.n, 1, 3) || ') ' || substr(t.n, 4, 3) || '-' || substr(t.n, 7, 2) || '-' || substr(t.n, 9, 2)
FROM (
  SELECT "id", CASE
    WHEN length(d) = 11 AND left(d, 1) IN ('7', '8') THEN substr(d, 2)
    WHEN length(d) = 10 THEN d
  END AS n
  FROM (SELECT "id", regexp_replace("phone", '\D', '', 'g') AS d FROM "Contact" WHERE "phone" IS NOT NULL AND "phone" !~ '^\s*\+[^7]') AS x
) AS t
WHERE "Contact"."id" = t."id" AND t.n IS NOT NULL;

UPDATE "Lead" SET "phone" = '+7 (' || substr(t.n, 1, 3) || ') ' || substr(t.n, 4, 3) || '-' || substr(t.n, 7, 2) || '-' || substr(t.n, 9, 2)
FROM (
  SELECT "id", CASE
    WHEN length(d) = 11 AND left(d, 1) IN ('7', '8') THEN substr(d, 2)
    WHEN length(d) = 10 THEN d
  END AS n
  FROM (SELECT "id", regexp_replace("phone", '\D', '', 'g') AS d FROM "Lead" WHERE "phone" IS NOT NULL AND "phone" !~ '^\s*\+[^7]') AS x
) AS t
WHERE "Lead"."id" = t."id" AND t.n IS NOT NULL;

UPDATE "Employee" SET "phone" = '+7 (' || substr(t.n, 1, 3) || ') ' || substr(t.n, 4, 3) || '-' || substr(t.n, 7, 2) || '-' || substr(t.n, 9, 2)
FROM (
  SELECT "id", CASE
    WHEN length(d) = 11 AND left(d, 1) IN ('7', '8') THEN substr(d, 2)
    WHEN length(d) = 10 THEN d
  END AS n
  FROM (SELECT "id", regexp_replace("phone", '\D', '', 'g') AS d FROM "Employee" WHERE "phone" IS NOT NULL AND "phone" !~ '^\s*\+[^7]') AS x
) AS t
WHERE "Employee"."id" = t."id" AND t.n IS NOT NULL;
