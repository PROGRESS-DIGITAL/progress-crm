# Развёртывание на сервере

Нужен VPS с Ubuntu 22.04+ или Debian 12 и 2 ГБ памяти. Подключитесь к нему по SSH и выполните одну команду:

```bash
curl -fsSL https://raw.githubusercontent.com/PROGRESS-DIGITAL/progress-crm/main/deploy/install.sh | sudo bash
```

Скрипт ставит Docker, добавляет файл подкачки для сборки, скачивает код, генерирует пароли
в `/opt/progress-crm/deploy/.env` и запускает базу, CRM, Caddy с HTTPS и ежедневные копии базы.
В конце он печатает адрес, логин, пароль и ссылку для webhook Тильды.

Без своего домена CRM открывается по адресу `https://<IP-сервера>.sslip.io`. Чтобы сразу
поставить свой, создайте A-запись на IP сервера и запустите скрипт с `DOMAIN=crm.progrs.ru`
(`curl … | sudo DOMAIN=crm.progrs.ru bash`). Демо-сделки добавляются при первом запуске;
`SEED_DEMO=0` запускает CRM с пустой воронкой.

Сервер каждые 10 минут проверяет ветку main и сам пересобирает CRM после слияния
(`deploy/update.sh`, лог в `/var/log/progress-crm-update.log`).

Обновить вручную, не дожидаясь проверки:

```bash
sudo bash /opt/progress-crm/deploy/update.sh
```

Копии базы складываются каждый день в `deploy/backups`. Восстановление:

```bash
cd /opt/progress-crm/deploy
gunzip -c backups/crm-2026-10-21.sql.gz | docker compose exec -T db psql -U crm progress_crm
```
