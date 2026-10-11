# Один образ приложения: собранный React + NestJS API с одного origin. Базовые образы мультиархитектурные (в т.ч. linux/arm64).
# Сборка не требует токенов и подключения к БД. PostgreSQL в образ не входит: сервер передаёт DATABASE_URL и PORT.

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8000 \
    WEB_DIST=/app/public
WORKDIR /app
COPY --from=server /server/package.json ./package.json
COPY --from=server /server/node_modules ./node_modules
COPY --from=server /server/dist ./dist
COPY --from=server /server/drizzle ./drizzle
COPY --from=web /web/dist ./public
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
# Миграции выполняются отдельной командой: npm run migrate
CMD ["node", "dist/main.js"]
