#!/usr/bin/env bash
# Запуск CRM в Codespaces: ждём базу, применяем миграции и демо-данные (повторно безопасно), стартуем сервер
set -e
cd "$(dirname "$0")/.."

echo "Жду PostgreSQL..."
for _ in $(seq 1 60); do
  (echo > /dev/tcp/localhost/5432) 2>/dev/null && break
  sleep 1
done

[ -d node_modules ] || npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma db seed

echo "Запускаю CRM на порту 3000. Когда появится Ready, откройте вкладку Ports → 3000."
exec npm run dev
