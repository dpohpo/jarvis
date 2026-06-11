# Jarvis relay — single small container, no external services.
FROM node:22-alpine AS build
WORKDIR /build
RUN corepack enable && corepack prepare pnpm@11.5.3 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/protocol ./packages/protocol
COPY packages/relay ./packages/relay
# strip any *.tsbuildinfo synced from a dev machine: composite tsc would see
# stale incremental state and emit nothing, leaving dist/ empty.
RUN find . -name "*.tsbuildinfo" -delete \
  && pnpm install --filter @jarvis/protocol --filter @jarvis/relay --frozen-lockfile \
  && pnpm --filter @jarvis/protocol build \
  && pnpm --filter @jarvis/relay build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DB_PATH=/data/relay.sqlite
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/packages ./packages
VOLUME /data
EXPOSE 8787
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "packages/relay/dist/server.js"]
