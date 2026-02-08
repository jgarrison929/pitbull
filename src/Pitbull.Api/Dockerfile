# =============================================================================
# Pitbull API - Multi-stage Docker build
# Build context: repo root
# Usage: docker build -f src/Pitbull.Api/Dockerfile .
# =============================================================================

# --- Stage 1: Build ---
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# Copy all .csproj files first for layer caching
COPY src/Pitbull.Api/Pitbull.Api.csproj src/Pitbull.Api/
COPY src/Modules/Pitbull.Core/Pitbull.Core.csproj src/Modules/Pitbull.Core/
COPY src/Modules/Pitbull.Projects/Pitbull.Projects.csproj src/Modules/Pitbull.Projects/
COPY src/Modules/Pitbull.Bids/Pitbull.Bids.csproj src/Modules/Pitbull.Bids/
COPY src/Modules/Pitbull.RFIs/Pitbull.RFIs.csproj src/Modules/Pitbull.RFIs/
COPY src/Modules/Pitbull.Contracts/Pitbull.Contracts.csproj src/Modules/Pitbull.Contracts/
COPY src/Modules/Pitbull.Documents/Pitbull.Documents.csproj src/Modules/Pitbull.Documents/
COPY src/Modules/Pitbull.Portal/Pitbull.Portal.csproj src/Modules/Pitbull.Portal/
COPY src/Modules/Pitbull.Billing/Pitbull.Billing.csproj src/Modules/Pitbull.Billing/
COPY src/Modules/Pitbull.TimeTracking/Pitbull.TimeTracking.csproj src/Modules/Pitbull.TimeTracking/
COPY src/Infrastructure/Pitbull.Email/Pitbull.Email.csproj src/Infrastructure/Pitbull.Email/
COPY src/Infrastructure/Pitbull.Storage/Pitbull.Storage.csproj src/Infrastructure/Pitbull.Storage/
COPY src/Infrastructure/Pitbull.Messaging/Pitbull.Messaging.csproj src/Infrastructure/Pitbull.Messaging/

# Restore dependencies (cached unless .csproj files change)
RUN dotnet restore src/Pitbull.Api/Pitbull.Api.csproj

# Copy source and publish
COPY src/ src/
RUN dotnet publish src/Pitbull.Api/Pitbull.Api.csproj \
    -c Release \
    -o /out \
    --no-restore

# --- Stage 2: Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

COPY --from=build /out .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}

EXPOSE 8080

ENTRYPOINT ["dotnet", "Pitbull.Api.dll"]
