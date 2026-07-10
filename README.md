# Pitbull Construction Solutions

[![CI](https://github.com/jgarrison929/pitbull/actions/workflows/ci.yml/badge.svg)](https://github.com/jgarrison929/pitbull/actions/workflows/ci.yml)
[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4)](https://dotnet.microsoft.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Modular construction ERP** for commercial general contractors — projects, bids, contracts, time tracking, AIA billing, project management, financials, and AI-assisted operations in one multi-tenant platform.

[Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [Vision](VISION.md) · [Security](SECURITY.md)

---

## Product

Pitbull is a modular monolith that covers the GC back office: job setup, bidding, subcontract SOV and change orders, crew time, RFIs/submittals/daily reports, owner payment applications (G702/G703), AP/AR and GL, WIP, and role-native executive dashboards.

| Layer | Technology |
|-------|------------|
| API | .NET 10, ASP.NET Core, EF Core 10, PostgreSQL 17 |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Auth | JWT + ASP.NET Identity, RBAC permissions, PostgreSQL RLS |
| Messaging | DotNetCore.CAP (PostgreSQL outbox + Redis) |
| Jobs | Hangfire |
| Tests | Unit + integration (Testcontainers / PostgreSQL) |

### Modules

- **Projects** — cost codes, phases, budgets  
- **Bids** — opportunity tracking, bid-to-project conversion  
- **Contracts** — subcontracts, change orders, SOV, payment applications  
- **TimeTracking** — crew entry, approvals, pay periods  
- **ProjectManagement** — schedule, RFIs, submittals, daily reports, tasks, punch lists  
- **Billing** — vendors, customers, GL, retention, lien waivers, AP/AR  
- **Reports** — labor cost, profitability, financial statements, exports  
- **AI** — provider abstraction (Anthropic / OpenAI) for summaries and document extraction  
- **SystemAdmin** — users, roles, settings, secrets vault, health  

See [docs/ROLE-EXPERIENCE.md](docs/ROLE-EXPERIENCE.md) for persona-specific home experiences (CEO, CFO, PM, Estimator).

---

## Quick Start

**Prerequisites:** Docker, .NET 10 SDK, Node.js 22

```bash
# Start PostgreSQL + Redis
docker compose up -d

# API (from repo root)
dotnet restore
dotnet ef database update -p src/Modules/Pitbull.Core -s src/Pitbull.Api
dotnet run --project src/Pitbull.Api

# Frontend
cd src/Pitbull.Web/pitbull-web
npm ci
cp .env.example .env.local   # set NEXT_PUBLIC_API_BASE_URL=http://localhost:5081
npm run dev
```

API: `http://localhost:5081` · Frontend: `http://localhost:3000`

Copy `.env.example` to `.env` for optional services (email, AI). Full setup: [CONTRIBUTING.md](CONTRIBUTING.md).

### Dev admin bootstrap

In Development, the API promotes the email in `appsettings.Development.json` → `DevAdmin:Email` to Admin on startup. Set it to your local user after registering.

---

## Project structure

```
src/
  Pitbull.Api/                 # API host, controllers, middleware
  Modules/
    Pitbull.Core/              # DbContext, multi-tenancy, shared entities
    Pitbull.Projects/
    Pitbull.Bids/
    Pitbull.Contracts/
    Pitbull.Billing/
    Pitbull.TimeTracking/
    Pitbull.ProjectManagement/
    Pitbull.AI/
    …
  Pitbull.Web/pitbull-web/     # Next.js frontend
tests/
  Pitbull.Tests.Unit/
  Pitbull.Tests.Integration/
docs/                          # Architecture, role experience, security, specs
deploy/                        # Railway / production setup
```

---

## Tests

```bash
dotnet test tests/Pitbull.Tests.Unit --configuration Release
dotnet test tests/Pitbull.Tests.Integration --configuration Release   # requires Docker
```

---

## Deployment

### Railway

See **[deploy/RAILWAY-SETUP.md](deploy/RAILWAY-SETUP.md)**.

```powershell
.\scripts\railway-setup.ps1 -ApiUrl "https://your-api.up.railway.app" -WebUrl "https://your-web.up.railway.app"
```

Services: **Postgres** + **pitbull-api** + **pitbull-web**. Deploys from `main`.

### Self-hosted

See [docker-compose.prod.yml](docker-compose.prod.yml) and [.env.example](.env.example).

| Variable | Description |
|----------|-------------|
| `ConnectionStrings__PitbullDb` or `DATABASE_URL` | PostgreSQL |
| `Jwt__Key` | JWT signing key (min 32 characters) |
| `Cors__AllowedOrigins__0` | Frontend origin |
| `NEXT_PUBLIC_API_BASE_URL` | API URL (frontend build-time) |
| `ANTHROPIC_API_KEY` | Optional — AI features |

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Role experience](docs/ROLE-EXPERIENCE.md)
- [Adding a module](docs/ADDING-A-MODULE.md)
- [Best practices](docs/BEST-PRACTICES.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md) · product version in root `VERSION`

---

## License

[MIT](LICENSE)
