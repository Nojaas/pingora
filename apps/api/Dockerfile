# syntax=docker/dockerfile:1

# Build from repo root:
#   docker build -f apps/api/Dockerfile --target prod -t pingora-api:prod .
#   docker build -f apps/api/Dockerfile --target dev -t pingora-api:dev .

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.11.0

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @pingora/api --docker

FROM base AS prod-builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
ENV NODE_ENV=production
# Dummy URL — prisma generate only needs a valid connection string shape at build time
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pingora
RUN pnpm turbo build --filter=@pingora/api
RUN pnpm deploy --filter=@pingora/api --prod --legacy /deploy

FROM node:${NODE_VERSION}-alpine AS prod
RUN apk add --no-cache libc6-compat openssl wget
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S pingora && adduser -S pingora -G pingora
COPY --from=prod-builder --chown=pingora:pingora /deploy .
USER pingora
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1
CMD ["node", "dist/index.js"]

FROM base AS dev
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "--filter", "@pingora/api", "dev"]
