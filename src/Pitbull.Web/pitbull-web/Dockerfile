# =============================================================================
# Pitbull Web - Multi-stage Next.js Docker build
# Build context: repository root
# Usage: docker build -f src/Pitbull.Web/pitbull-web/Dockerfile .
# =============================================================================

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app

COPY src/Pitbull.Web/pitbull-web/package.json src/Pitbull.Web/pitbull-web/package-lock.json* ./
RUN npm ci --production=false

# --- Stage 2: Build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src/Pitbull.Web/pitbull-web/ .

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_DISABLE_REGISTRATION=false
ARG NEXT_PUBLIC_APP_VERSION=2.18.4
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
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]