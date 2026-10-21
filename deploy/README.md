# Развёртывание на сервере

Нужен сервер с Ubuntu 22.04+ (2 ГБ памяти достаточно) и домен, A-запись которого указывает на сервер.

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Код
git clone https://github.com/PROGRESS-DIGITAL/progress-crm.git
cd progress-crm/deploy

# 3. Настройки
cp .env.example .env
nano .env            # домен, пароли, ключ Тильды

# 4. Запуск
docker compose up -d --build
```

Через минуту CRM откроется по `https://<домен>`: Caddy сам выпустит сертификат Let's Encrypt.
Браузер спросит общий логин и пароль из `.env`.

Обновление до свежей версии:

```bash
cd progress-crm && git pull && cd deploy && docker compose up -d --build
```

Копии базы складываются каждый день в `deploy/backups`. Восстановление:

```bash
gunzip -c backups/crm-2026-10-21.sql.gz | docker compose exec -T db psql -U crm progress_crm
```
