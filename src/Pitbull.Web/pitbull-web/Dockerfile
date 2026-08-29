# =============================================================================
# Pitbull Web - Multi-stage Next.js Docker build
# Build context: repository root
# Usage: docker build -f src/Pitbull.Web/pitbull-web/Dockerfile .
# =============================================================================

# --- Stage 1: Dependencies ---
# Pin by digest for supply-chain integrity (tag kept for human readability).
# Digest resolved 2026-08-28 from Docker Hub multi-arch index for node:24-alpine (Active LTS).
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS deps
WORKDIR /app

COPY src/Pitbull.Web/pitbull-web/package.json src/Pitbull.Web/pitbull-web/package-lock.json* src/Pitbull.Web/pitbull-web/.npmrc ./
# npm 11 (Node 24) fails ERESOLVE on typescript@7 vs typescript-eslint@8 peers without this.
RUN npm ci --legacy-peer-deps

# --- Stage 2: Build ---
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src/Pitbull.Web/pitbull-web/ .

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_DISABLE_REGISTRATION=false
ARG NEXT_PUBLIC_APP_VERSION=3.8.0
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ARG COMMIT_HASH=unknown
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_DISABLE_REGISTRATION=${NEXT_PUBLIC_DISABLE_REGISTRATION}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}
ENV NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
ENV NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}
ENV NEXT_PUBLIC_COMMIT_HASH=${COMMIT_HASH}

RUN npm run build

# --- Stage 3: Runtime ---
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]