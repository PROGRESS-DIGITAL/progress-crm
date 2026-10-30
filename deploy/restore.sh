#!/usr/bin/env bash
# Заливает в CRM на сервере базу из копии: с Мака (pg_dump -Fc, файл .dump) или из deploy/backups (.sql.gz).
#   sudo bash /opt/progress-crm/deploy/restore.sh /root/crm-data.dump
# Текущая база перед этим сохраняется в deploy/backups/before-restore-<дата>.sql.gz
set -euo pipefail

FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Укажите файл копии: sudo bash restore.sh /root/crm-data.dump" >&2
  exit 1
fi
FILE="$(realpath "$FILE")"
cd "$(dirname "$0")"

psql_db() { docker compose exec -T db psql -q -v ON_ERROR_STOP=1 -U crm "$@"; }

echo "==> Сохраняю текущую базу"
mkdir -p backups
docker compose exec -T db pg_dump -U crm progress_crm | gzip > "backups/before-restore-$(date +%F-%H%M).sql.gz"

echo "==> Останавливаю CRM"
docker compose stop app

echo "==> Заливаю $FILE"
psql_db -d postgres -c "DROP DATABASE IF EXISTS progress_crm WITH (FORCE)" -c "CREATE DATABASE progress_crm OWNER crm"
case "$FILE" in
  *.sql.gz) gunzip -c "$FILE" | psql_db -d progress_crm ;;
  *.sql) psql_db -d progress_crm < "$FILE" ;;
  # pg_restore завершается с ошибкой и на безобидных предупреждениях (владельцы, расширения): их только показываем
  *) docker compose exec -T db pg_restore --no-owner --no-privileges -U crm -d progress_crm < "$FILE" \
    || echo "pg_restore выдал предупреждения выше; CRM всё равно запускается" ;;
esac

echo "==> Запускаю CRM (новые изменения базы применятся сами)"
docker compose start app
echo "Готово: данные перенесены."
