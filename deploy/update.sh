#!/usr/bin/env bash
# Подтягивает свежий main и пересобирает CRM, пока последняя версия не соберётся
set -euo pipefail
cd "$(dirname "$0")/.."

# Одно обновление за раз: cron запускает скрипт каждые 10 минут, а сборка на слабом сервере идёт дольше,
# и две сборки сразу забивали диск и сталкивались контейнерами. Ручной запуск во время автоматического
# тоже ждать не будет: просто выходим
exec 9>/tmp/progress-crm-update.lock
if ! flock -n 9; then
  echo "Обновление уже идёт, дождитесь его окончания" >&2
  exit 0
fi

# Демо, включённое до перехода на сброс раз в неделю: переписываем его ежесуточное расписание
DEMO_CRON=/etc/cron.d/progress-crm-demo
if [ -f "$DEMO_CRON" ] && grep -q '^0 0 \* \* \* ' "$DEMO_CRON"; then
  echo "0 0 * * 1 root cd $(pwd)/deploy && (docker compose rm -sf demo-app demo-db && docker volume rm -f progress-crm-demo-db && docker compose up -d demo-db demo-app) >> /var/log/progress-crm-demo.log 2>&1" > "$DEMO_CRON"
fi

# Помечаем версию собранной только после удачной сборки: если сборка упала
# (например, кончилось место), следующий запуск по cron попробует снова
BUILT=deploy/.built-rev
git fetch -q origin main
TARGET="$(git rev-parse origin/main)"
if [ "$TARGET" = "$(cat "$BUILT" 2>/dev/null || true)" ]; then
  exit 0
fi

echo "$(date -Is) обновление до $(git rev-parse --short origin/main)"
git merge -q --ff-only origin/main
cd deploy
docker compose up -d --build
echo "$TARGET" > .built-rev
# Старые образы и кэш сборки за несколько обновлений съедают весь диск
docker image prune -f >/dev/null
docker builder prune -af --filter until=24h >/dev/null
