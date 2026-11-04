#!/usr/bin/env bash
# Подтягивает свежий main и пересобирает CRM, пока последняя версия не соберётся
set -euo pipefail
cd "$(dirname "$0")/.."

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
