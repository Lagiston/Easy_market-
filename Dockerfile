# Multi-stage build for the Halatu Bun workspaces monorepo (client + core +
# server). Railway builds this directly (railway.json sets builder:
# DOCKERFILE) instead of Nixpacks auto-detection.

# ---- deps: install once, cached across builds as long as lockfiles/package.json don't change ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY client/package.json client/package.json
COPY core/package.json core/package.json
COPY server/package.json server/package.json
RUN bun install --frozen-lockfile

# ---- build: full source, generate the Prisma client, build the client SPA ----
FROM deps AS build
WORKDIR /app
COPY . .
RUN bun run --cwd server generate
# Vite bakes VITE_* vars into the built bundle at build time, so it must be
# passed as a build ARG (Railway's build-time env vars are exposed this way
# for Dockerfile builds) rather than read at container runtime.
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN bun run --cwd client build

# ---- runtime: only what's needed to run the server + serve the built client ----
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/core ./core
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

EXPOSE 3000
# Railway's railway.json deploy.startCommand takes precedence over this CMD;
# it's kept as a correct default for running the image directly
# (`docker run`) outside Railway.
CMD ["sh", "-c", "bun run --cwd server migrate:deploy && bun run --cwd server start"]
