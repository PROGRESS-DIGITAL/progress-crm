# Развёртывание на сервере

Нужен VPS с Ubuntu 22.04+ или Debian 12 и 2 ГБ памяти. Подключитесь к нему по SSH и выполните одну команду:

```bash
curl -fsSL https://raw.githubusercontent.com/PROGRESS-DIGITAL/progress-crm/main/deploy/install.sh | sudo bash
```

Скрипт ставит Docker, добавляет файл подкачки для сборки, скачивает код, генерирует пароли
в `/opt/progress-crm/deploy/.env` и запускает базу, CRM, Caddy с HTTPS и ежедневные копии базы.
В конце он печатает адрес, ключ установки и ссылку для webhook Тильды.

Без своего домена CRM открывается по адресу `https://<IP-сервера>.sslip.io`. Чтобы сразу
поставить свой, создайте A-запись на IP сервера и запустите скрипт с `DOMAIN=crm.progrs.ru`
(`curl … | sudo DOMAIN=crm.progrs.ru bash`). Демо-сделки добавляются при первом запуске;
`SEED_DEMO=0` запускает CRM с пустой воронкой.

## Timeweb Cloud

1. Создайте облачный сервер: Ubuntu 24.04, от 2 ГБ памяти. Локацию лучше выбрать за пределами России
   (например, Нидерланды): API Claude из России не работает, а Telegram оттуда доступен без прокси.
2. В DNS поддомена добавьте A-запись на IP сервера.
3. Откройте консоль сервера (в панели Timeweb или по SSH) и выполните, подставив свой поддомен:

```bash
curl -fsSL https://raw.githubusercontent.com/PROGRESS-DIGITAL/progress-crm/main/deploy/install.sh | sudo DOMAIN=crm.example.ru bash
```

Сертификат HTTPS Caddy получает сам, как только поддомен начинает указывать на сервер, и сам его продлевает.

## Перенос данных с Мака

На Маке, при запущенном Docker, сохраните базу в файл и отправьте на сервер (пароль root — из панели Timeweb):

```bash
docker exec progress-crm-iteration-6-local-db-1 pg_dump -U crm -Fc progress_crm > ~/Desktop/crm-data.dump
scp ~/Desktop/crm-data.dump root@IP-СЕРВЕРА:/root/
```

На сервере:

```bash
sudo bash /opt/progress-crm/deploy/restore.sh /root/crm-data.dump
```

Переносятся клиенты, сделки, переписки, письма и все ключи из «Интеграций». Текущая база сервера
перед этим сохраняется в `deploy/backups/before-restore-…`. После переноса остановите CRM на Маке:
два экземпляра с одним ботом Telegram мешают друг другу получать сообщения.

Если Telegram с сервера недоступен, впишите прокси в `deploy/.env` (`TELEGRAM_PROXY=http://user:pass@host:port`)
и выполните `docker compose up -d` в `/opt/progress-crm/deploy`, или укажите прокси в «Интеграциях».

## Вход

При первом открытии CRM просит ключ установки (его напечатал `install.sh`, он же лежит в `deploy/.env`
как `SETUP_KEY`), имя, логин и пароль директора. Следующим шагом подключается приложение для кодов
входа: Яндекс Ключ, Google Authenticator или похожее. После переноса базы с Мака логин, пароль
и приложение остаются те же, что были на Маке.

Сотрудников добавляет директор в разделе «Сотрудники». Если директор забыл пароль или потерял телефон
с приложением, на сервере:

```bash
cd /opt/progress-crm/deploy
docker compose exec app npx tsx scripts/reset-login.ts
```

Скрипт печатает временный пароль и сбрасывает код из приложения; при входе CRM попросит сменить пароль
и подключить приложение заново.

## Если сайт не открывается из России

Российские провайдеры могут не пропускать соединения с зарубежным сервером: ssh работает, а сайт
не отвечает. Тогда нужен небольшой сервер в России (Ubuntu, 1 ГБ памяти), который пересылает соединения
на основной. Шифрование при этом не снимается: сертификат и данные остаются на основном сервере.

На сервере в России:

```bash
curl -fsSL https://raw.githubusercontent.com/PROGRESS-DIGITAL/progress-crm/main/deploy/relay.sh | sudo DOMAIN=crm.example.ru TARGET=IP-основного-сервера bash
```

Скрипт проверит, что основной сервер отвечает, и напечатает два последних шага: разрешить адрес
нового сервера на основном (`RELAY_IP` в `deploy/.env`, чтобы в журнале входов были настоящие адреса
посетителей) и перевести A-запись поддомена на новый сервер.

## Обновления

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
