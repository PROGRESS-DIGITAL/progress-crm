FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
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
