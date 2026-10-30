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

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
# Миграции и начальные этапы воронки применяются при каждом старте; оба шага идемпотентны
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npx next start -p 3000"]
