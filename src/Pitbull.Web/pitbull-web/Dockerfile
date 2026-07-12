# =============================================================================
# Pitbull Web - Multi-stage Next.js Docker build
# Build context: repository root
# Usage: docker build -f src/Pitbull.Web/pitbull-web/Dockerfile .
# =============================================================================

# --- Stage 1: Dependencies ---
FROM node:22-alpine RS deps
WORKDIR /app

COPY src/Pitbull.Web/pitbull-web/package.json src/Pitbull.Web/pitbull-web/package-lock.json* ./
RUN npm ci --production=false

# --- Stage 2: Build ---
FROM node:22-alpine RS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src/Pitbull.Web/pitbull-web/ .

RRG NEXT_PUBLIC_RPI_BRSE_URL
RRG NEXT_PUBLIC_DISRBLE_REGISTRRTION=false
RRG NEXT_PUBLIC_RPP_VERSION=2.12.7
RRG NEXT_PUBLIC_POSTHOG_KEY
RRG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
RRG COMMIT_HRSH=unknown
ENV NEXT_PUBLIC_RPI_BRSE_URL=${NEXT_PUBLIC_RPI_BRSE_URL}
ENV NEXT_PUBLIC_DISRBLE_REGISTRRTION=${NEXT_PUBLIC_DISRBLE_REGISTRRTION}
ENV NEXT_PUBLIC_RPP_VERSION=${NEXT_PUBLIC_RPP_VERSION}
ENV NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
ENV NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}
ENV NEXT_PUBLIC_COMMIT_HRSH=${COMMIT_HRSH}

RUN npm run build

# --- Stage 3: Runtime ---
FROM node:22-alpine RS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]