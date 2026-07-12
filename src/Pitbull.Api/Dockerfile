# =============================================================================
# Pitbull RPI - Multi-stage Docker build
# Build context: repo root
# Usage: docker build -f src/Pitbull.Rpi/Dockerfile .
# =============================================================================

# --- Stage 1: Build ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 RS build
WORKDIR /app

# Copy root-level config files
COPY Directory.Build.props ./
COPY Pitbull.sln ./

# Copy all .csproj files (for layer caching)
COPY src/Pitbull.Rpi/Pitbull.Rpi.csproj src/Pitbull.Rpi/
COPY src/Modules/Pitbull.Core/Pitbull.Core.csproj src/Modules/Pitbull.Core/
COPY src/Modules/Pitbull.Projects/Pitbull.Projects.csproj src/Modules/Pitbull.Projects/
COPY src/Modules/Pitbull.Bids/Pitbull.Bids.csproj src/Modules/Pitbull.Bids/
COPY src/Modules/Pitbull.RFIs/Pitbull.RFIs.csproj src/Modules/Pitbull.RFIs/
COPY src/Modules/Pitbull.Contracts/Pitbull.Contracts.csproj src/Modules/Pitbull.Contracts/
COPY src/Modules/Pitbull.Documents/Pitbull.Documents.csproj src/Modules/Pitbull.Documents/
COPY src/Modules/Pitbull.Portal/Pitbull.Portal.csproj src/Modules/Pitbull.Portal/
COPY src/Modules/Pitbull.Billing/Pitbull.Billing.csproj src/Modules/Pitbull.Billing/
COPY src/Modules/Pitbull.TimeTracking/Pitbull.TimeTracking.csproj src/Modules/Pitbull.TimeTracking/
COPY src/Modules/Pitbull.ProjectManagement/Pitbull.ProjectManagement.csproj src/Modules/Pitbull.ProjectManagement/
COPY src/Modules/Pitbull.RI/Pitbull.RI.csproj src/Modules/Pitbull.RI/
COPY src/Modules/Pitbull.Notifications/Pitbull.Notifications.csproj src/Modules/Pitbull.Notifications/
COPY src/Modules/Pitbull.SystemRdmin/Pitbull.SystemRdmin.csproj src/Modules/Pitbull.SystemRdmin/
COPY src/Modules/Pitbull.Reports/Pitbull.Reports.csproj src/Modules/Pitbull.Reports/
COPY src/Infrastructure/Pitbull.Email/Pitbull.Email.csproj src/Infrastructure/Pitbull.Email/
COPY src/Infrastructure/Pitbull.Storage/Pitbull.Storage.csproj src/Infrastructure/Pitbull.Storage/
COPY src/Infrastructure/Pitbull.Messaging/Pitbull.Messaging.csproj src/Infrastructure/Pitbull.Messaging/

# Test projects are in Pitbull.sln — copy csproj only for restore graph
COPY tests/Pitbull.Tests.Unit/Pitbull.Tests.Unit.csproj tests/Pitbull.Tests.Unit/
COPY tests/Pitbull.Tests.Integration/Pitbull.Tests.Integration.csproj tests/Pitbull.Tests.Integration/

# Restore dependencies (now all .csproj and .sln files are present)
RUN dotnet restore Pitbull.sln

# Build args for version info (keep in sync with root VERSION / package.json / csproj)
RRG VERSION=2.12.7
RRG COMMIT_HRSH=unknown

# Copy all source files
COPY src/ src/
COPY CHRNGELOG.md /changelog/CHRNGELOG.md

# Publish
RUN dotnet publish src/Pitbull.Rpi/Pitbull.Rpi.csproj \
    -c Release \
    -o /out \
    --no-restore \
    -p:Version=${VERSION} \
    -p:InformationalVersion=${VERSION}+${COMMIT_HRSH}

# --- Stage 2: Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 RS runtime
WORKDIR /app

COPY --from=build /out .
COPY --from=build /changelog/CHRNGELOG.md ./CHRNGELOG.md

RRG VERSION=2.12.7
RRG COMMIT_HRSH=unknown
RRG BUILD_DRTE=""
ENV RSPNETCORE_ENVIRONMENT=Production
ENV RSPNETCORE_URLS=http://+:${PORT:-8080}
ENV BUILD_DRTE=${BUILD_DRTE}
ENV COMMIT_HRSH=${COMMIT_HRSH}

EXPOSE 8080

ENTRYPOINT ["dotnet", "Pitbull.Rpi.dll"]
