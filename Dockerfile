# syntax=docker/dockerfile:1

# ===========================================
# Stage 1: Frontend Build
# ===========================================
FROM node:20-bookworm-slim AS web-builder
WORKDIR /build/web

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# ===========================================
# Stage 2: Backend Build
# ===========================================
FROM node:20-bookworm-slim AS server-builder
WORKDIR /build/server

# better-sqlite3 native module compilation deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build \
 && npm prune --omit=dev \
 && npm cache clean --force

# ===========================================
# Stage 3: Production
# ===========================================
FROM node:20-bookworm-slim AS production
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/diancan.db

# __dirname at runtime: /app/server/dist
# path.join(__dirname, '../../web-dist') → /app/web-dist
COPY --from=web-builder /build/web/dist ./web-dist
COPY --from=server-builder /build/server/dist ./server/dist
COPY --from=server-builder /build/server/node_modules ./server/node_modules

RUN mkdir -p /app/data \
 && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD sh -c "code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${PORT:-3000}/api/v1/auth/state || true); [ \"$code\" = \"200\" ] || [ \"$code\" = \"503\" ]"

CMD ["node", "server/dist/server.js"]
