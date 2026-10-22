#!/usr/bin/env bash
# Установка CRM на чистый VPS (Ubuntu/Debian) одной командой:
#   curl -fsSL https://raw.githubusercontent.com/PROGRESS-DIGITAL/progress-crm/main/deploy/install.sh | sudo bash
# Повторный запуск безопасен: существующие настройки и база сохраняются.
set -euo pipefail

REPO_URL="https://github.com/PROGRESS-DIGITAL/progress-crm.git"
APP_DIR="/opt/progress-crm"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root: sudo bash install.sh" >&2
  exit 1
fi

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq git; }

# Сборке Next.js не хватает 1–2 ГБ памяти, поэтому добавляем файл подкачки
if [ "$(swapon --noheadings | wc -l)" -eq 0 ]; then
  echo "==> Файл подкачки 2 ГБ"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> Код"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi

ENV_FILE="$APP_DIR/deploy/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "==> Настройки"
  # Без своего домена используем адрес вида 1.2.3.4.sslip.io: он указывает на IP сервера
  # и для него тоже выпускается HTTPS-сертификат
  if [ -z "${DOMAIN:-}" ]; then
    IP="$(curl -fsS4 https://api.ipify.org)"
    DOMAIN="$IP.sslip.io"
  fi
  cat > "$ENV_FILE" <<ENV
DOMAIN=$DOMAIN
POSTGRES_PASSWORD=$(openssl rand -hex 16)
TILDA_WEBHOOK_KEY=$(openssl rand -hex 16)
BASIC_AUTH_USER=progress
BASIC_AUTH_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=')
SEED_DEMO=${SEED_DEMO:-1}
ENV
  chmod 600 "$ENV_FILE"
fi

echo "==> Сборка и запуск (первый раз несколько минут)"
cd "$APP_DIR/deploy"
docker compose up -d --build

# Каждые 10 минут проверяем main и пересобираем, если появились новые слияния
cat > /etc/cron.d/progress-crm <<CRON
*/10 * * * * root bash $APP_DIR/deploy/update.sh >> /var/log/progress-crm-update.log 2>&1
CRON

set -a; . "$ENV_FILE"; set +a
cat <<DONE

Готово.
  CRM:          https://$DOMAIN
  Логин:        $BASIC_AUTH_USER
  Пароль:       $BASIC_AUTH_PASSWORD
  Webhook Тильды: https://$DOMAIN/api/webhooks/tilda?key=$TILDA_WEBHOOK_KEY

Настройки лежат в $ENV_FILE, копии базы в $APP_DIR/deploy/backups.
DONE
