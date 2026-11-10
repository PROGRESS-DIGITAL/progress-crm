FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
# Сертификат Минцифры: на нём работают Точка и другие российские сервисы, а в Node.js его нет.
# Если сайт Госуслуг недоступен, сборка продолжается без него
RUN for f in russian_trusted_root_ca_pem.crt russian_trusted_sub_ca_pem.crt; do \
      curl -fsS --max-time 20 "https://gu-st.ru/content/lending/$f" -o "/usr/local/share/ca-certificates/$f" \
        && openssl x509 -in "/usr/local/share/ca-certificates/$f" -noout 2>/dev/null \
        || rm -f "/usr/local/share/ca-certificates/$f"; \
    done; \
    update-ca-certificates >/dev/null
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app

# Одна стадия: раньше готовая CRM копировалась в отдельный образ целиком, и node_modules (около 1 ГБ)
# лежали на диске дважды. На сервере с 14 ГБ сборка из-за этого упиралась в место
FROM base AS run
COPY package.json package-lock.json ./
# На этом образе glibc: musl-сборки компилятора Next.js и lightningcss не нужны (~100 МБ)
RUN npm ci && rm -rf node_modules/@next/swc-linux-x64-musl node_modules/lightningcss-linux-x64-musl && npm cache clean --force
COPY . .
# Кэш сборки Next.js (~150 МБ) удаляем в том же слое, чтобы он не попал в образ
RUN npx prisma generate && npm run build && rm -rf .next/cache
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
# Миграции и начальные этапы воронки применяются при каждом старте; оба шага идемпотентны
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npx next start -p 3000"]
