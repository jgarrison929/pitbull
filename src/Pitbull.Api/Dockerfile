# =============================================================================
# Pitbull API - Multi-stage Docker build
# Build context: repo root
# Usage: docker build -f src/Pitbull.Api/Dockerfile .
# =============================================================================

# --- Stage 1: Build ---
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# Copy all source files first (before restore)
COPY src/ src/
COPY . .

# Restore dependencies (now .csproj files are present)
RUN dotnet restore src/Pitbull.Api/Pitbull.Api.csproj

# Build args for version info
ARG VERSION=0.15.0
ARG COMMIT_HASH=unknown

# Publish
RUN dotnet publish src/Pitbull.Api/Pitbull.Api.csproj \
    -c Release \
    -o /out \
    --no-restore \
    -p:Version=${VERSION} \
    -p:InformationalVersion=${VERSION}+${COMMIT_HASH}

# --- Stage 2: Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

COPY --from=build /out .

ARG VERSION=0.15.0
ARG COMMIT_HASH=unknown
ARG BUILD_DATE=""
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}
ENV BUILD_DATE=${BUILD_DATE}
ENV COMMIT_HASH=${COMMIT_HASH}

EXPOSE 8080

ENTRYPOINT ["dotnet", "Pitbull.Api.dll"]
