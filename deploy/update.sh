#!/usr/bin/env bash
# Подтягивает свежий main и пересобирает CRM, только если код изменился
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch -q origin main
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  exit 0
fi

echo "$(date -Is) обновление до $(git rev-parse --short origin/main)"
git merge -q --ff-only origin/main
cd deploy
docker compose up -d --build
docker image prune -f >/dev/null
