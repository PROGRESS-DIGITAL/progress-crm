#!/usr/bin/env bash
# Демо-версия CRM для клиентов на том же сервере: отдельная база с вымышленными данными на своём поддомене.
#   sudo bash /opt/progress-crm/deploy/demo.sh demo.crm.example.ru   — включить (или сменить поддомен)
#   sudo bash /opt/progress-crm/deploy/demo.sh off                   — выключить
# Без аргумента на адресе вида 1.2.3.4.sslip.io демо открывается на demo.1.2.3.4.sslip.io
set -euo pipefail
cd "$(dirname "$0")"
DEPLOY_DIR="$(pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
CRON_FILE=/etc/cron.d/progress-crm-demo

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root: sudo bash demo.sh" >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Нет $ENV_FILE: сначала установите CRM (deploy/install.sh)" >&2
  exit 1
fi

# Убираем из .env прежние настройки демо, остальное не трогаем
sed -i '/^DEMO_DOMAIN=/d;/^COMPOSE_FILE=/d' "$ENV_FILE"

if [ "${1:-}" = "off" ]; then
  echo "==> Выключаю демо-версию"
  # Рабочая CRM возвращается к обычному имени образа: берём уже собранный, чтобы не собирать заново
  docker image inspect progress-crm-app:latest >/dev/null 2>&1 && docker tag progress-crm-app:latest deploy-app:latest
  docker compose up -d --remove-orphans
  docker volume rm -f progress-crm-demo-db >/dev/null
  rm -f "$CRON_FILE"
  echo "Готово: демо-версия остановлена, её база удалена."
  exit 0
fi

DOMAIN="$(grep '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"
DEMO_DOMAIN="${1:-}"
if [ -z "$DEMO_DOMAIN" ]; then
  case "$DOMAIN" in
    *.sslip.io) DEMO_DOMAIN="demo.$DOMAIN" ;;
    *)
      echo "Укажите поддомен демо-версии, например: sudo bash demo.sh demo.$DOMAIN" >&2
      echo "Перед этим добавьте для него A-запись на IP этого сервера." >&2
      exit 1
      ;;
  esac
fi
if [ "$DEMO_DOMAIN" = "$DOMAIN" ]; then
  echo "Демо должно жить на отдельном поддомене, не на $DOMAIN" >&2
  exit 1
fi

cat >> "$ENV_FILE" <<ENV
DEMO_DOMAIN=$DEMO_DOMAIN
COMPOSE_FILE=docker-compose.yml:docker-compose.demo.yml
ENV

# Демо работает на том же образе, что и рабочая CRM. Если CRM уже собрана из текущей версии кода,
# берём её образ как есть: новая сборка заняла бы ещё пару гигабайт диска
APP_CONTAINER="$(docker compose -f docker-compose.yml ps -q app 2>/dev/null || true)"
APP_IMAGE="$( [ -n "$APP_CONTAINER" ] && docker inspect --format '{{.Image}}' "$APP_CONTAINER" 2>/dev/null || true)"
if [ -n "$APP_IMAGE" ] && [ "$(cat .built-rev 2>/dev/null || true)" = "$(git -C .. rev-parse HEAD)" ]; then
  echo "==> Беру уже собранный образ CRM"
  docker tag "$APP_IMAGE" progress-crm-app:latest
else
  echo "==> Сборка CRM (5–10 минут)"
  docker compose build app
fi
echo "==> Запуск"
docker compose up -d

# Раз в неделю, в ночь на понедельник, демо-база создаётся заново: всё, что гости поменяли, возвращается к исходным данным
cat > "$CRON_FILE" <<CRON
0 0 * * 1 root cd $DEPLOY_DIR && (docker compose rm -sf demo-app demo-db && docker volume rm -f progress-crm-demo-db && docker compose up -d demo-db demo-app) >> /var/log/progress-crm-demo.log 2>&1
CRON

cat <<DONE

Готово.
  Демо-версия: https://$DEMO_DOMAIN
  Вход — кнопкой «Войти в демо-версию», без пароля. Данные вымышленные и сбрасываются раз в неделю, в ночь на понедельник.
  Рабочая CRM и её база не затронуты: демо работает в отдельной сети со своей базой.
DONE
