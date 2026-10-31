#!/usr/bin/env bash
# Промежуточный сервер в России: принимает посетителей CRM и пересылает соединения на основной сервер.
# Нужен, когда российские провайдеры не пропускают соединения с зарубежным сервером напрямую.
# Запуск на чистом сервере Ubuntu в России:
#   curl -fsSL https://raw.githubusercontent.com/PROGRESS-DIGITAL/progress-crm/main/deploy/relay.sh | sudo DOMAIN=crm.example.ru TARGET=1.2.3.4 bash
# TARGET — IP основного сервера с CRM. Шифрование не снимается: сертификат и данные остаются на основном сервере
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите от root: sudo bash relay.sh" >&2
  exit 1
fi
: "${DOMAIN:?Укажите DOMAIN, например DOMAIN=crm.progrs.ru}"
: "${TARGET:?Укажите TARGET — IP основного сервера с CRM}"

echo "==> Проверяю, что основной сервер доступен отсюда"
code="$(curl -s -m 15 -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:$TARGET" "https://$DOMAIN/login" || true)"
if [ "$code" != "200" ]; then
  echo "Основной сервер $TARGET не ответил (код ${code:-нет ответа}). Проверьте IP и что CRM на нём запущена." >&2
  exit 1
fi

echo "==> nginx"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx libnginx-mod-stream >/dev/null

# Порты 80 и 443 целиком уходят на основной сервер, поэтому сайт nginx по умолчанию не нужен
rm -f /etc/nginx/sites-enabled/default
cat > /etc/nginx/progress-relay.conf <<CONF
# Пересылка соединений CRM на $TARGET. proxy_protocol передаёт настоящий адрес посетителя;
# порт 80 только перенаправляет на HTTPS и выпускает сертификат, адрес там не нужен
stream {
  server {
    listen 443;
    listen [::]:443;
    proxy_pass $TARGET:443;
    proxy_protocol on;
  }
  server {
    listen 80;
    listen [::]:80;
    proxy_pass $TARGET:80;
  }
}
CONF
grep -q "progress-relay.conf" /etc/nginx/nginx.conf || echo "include /etc/nginx/progress-relay.conf;" >> /etc/nginx/nginx.conf
nginx -t -q
systemctl enable -q nginx
systemctl restart nginx

IP="$(curl -fsS4 https://api.ipify.org)"
cat <<DONE

Готово. Этот сервер: $IP

Осталось два шага:
  1. На основном сервере ($TARGET) разрешите адрес этого сервера:
       cd /opt/progress-crm/deploy && echo "RELAY_IP=$IP/32" >> .env && docker compose up -d caddy
  2. В DNS поменяйте A-запись $DOMAIN на $IP.

Проверить, что пересылка работает, можно отсюда:
  curl -sI --resolve $DOMAIN:443:127.0.0.1 https://$DOMAIN/login | head -1
DONE
