# Pitbull Construction Solutions

[![CI](https://github.com/jgarrison929/pitbull/actions/workflows/ci.yml/badge.svg)](https://github.com/jgarrison929/pitbull/actions/workflows/ci.yml)
[![.NET](https://img.shields.io/badge/.NET-9.0-512BD4)](https://dotnet.microsoft.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**A learning project:** a full-stack construction ERP built with AI-assisted development.

This is my first serious "vibe coded" application — built to learn modern .NET, multi-tenant SaaS patterns, and construction domain modeling. It's rough in places, but the architecture, test coverage, and module boundaries are real.

**[Live demo](https://demo.example.com)** · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md)

---

## What I Built

A modular monolith for commercial general contractors: projects, bids, contracts, time tracking, billing (AIA G702/G703), RFIs, submittals, and AI-assisted project insights.

| Layer | Tech |
|-------|------|
| API | .NET 9, ASP.NET Core, EF Core, PostgreSQL 17 |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Auth | JWT + ASP.NET Identity, row-level security (RLS) |
| Events | DotNetCore.CAP (PostgreSQL outbox + Redis) |
| Tests | 1,800+ unit + integration (Testcontainers) |

### Modules shipped

- **Projects** — cost codes, phases, budgets
- **Bids** — opportunity tracking, bid-to-project conversion
- **Contracts** — subcontracts, change orders, SOV, payment applications
- **TimeTracking** — crew entry, approval workflow, pay periods
- **ProjectManagement** — schedule, RFIs, submittals, daily reports, tasks
- **Billing** — vendors, GL, retention, lien waivers, AP/AR
- **AI** — Claude-powered project health summaries
- **Reports** — labor cost, profitability, CSV exports

---

## What I Learned

Things I figured out (often the hard way) while building this:

- **Multi-tenancy with PostgreSQL RLS** — tenant + company isolation at the database layer, not just in application code
- **Modular monolith boundaries** — 14 modules sharing one DbContext without turning into spaghetti
- **CQRS without MediatR** — direct service injection after MediatR went commercial; simpler and faster
- **Construction domain modeling** — retainage, SOV, certified payroll concepts, change order workflows
- **Testcontainers for integration tests** — real PostgreSQL in CI, not mocked DbContext
- **AI-native development** — agent skills, compound learning docs, systematic code review loops

See [docs/solutions/](docs/solutions/) for specific bugs and patterns I captured along the way.

---

## Quick Start

**Prerequisites:** Docker, .NET 9 SDK, Node.js 22

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

Copy `.env.example` to `.env` for optional services (email, AI). See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup.

### Dev admin bootstrap

In Development, the API promotes the email in `appsettings.Development.json` → `DevAdmin:Email` to Admin on startup. Change it to your local user email after registering.

---

## Project Structure

```
src/
  Pitbull.Api/              # API host, controllers, middleware
  Modules/
    Pitbull.Core/           # DbContext, multi-tenancy, shared entities
    Pitbull.Projects/       # Projects, cost codes, phases
    Pitbull.Bids/           # Bid management
    Pitbull.Contracts/      # Subcontracts, change orders, SOV
    Pitbull.Billing/        # Payment apps, GL, AP/AR
    Pitbull.TimeTracking/   # Time entries, payroll workflow
    Pitbull.ProjectManagement/  # RFIs, submittals, daily reports
    Pitbull.AI/             # AI provider abstraction
  Pitbull.Web/pitbull-web/  # Next.js frontend
tests/
  Pitbull.Tests.Unit/       # In-memory DB unit tests
  Pitbull.Tests.Integration/  # Testcontainers + PostgreSQL
docs/                       # Architecture, specs, role docs
```

---

## Running Tests

```bash
# Unit tests
dotnet test tests/Pitbull.Tests.Unit --configuration Release

# Integration tests (requires Docker)
dotnet test tests/Pitbull.Tests.Integration --configuration Release
```

---

## Deployment

Railway auto-deploy from `main`. See [docs/deployment/](docs/deployment/) for Railway and self-hosted Docker Compose instructions.

| Variable | Description |
|----------|-------------|
| `ConnectionStrings__PitbullDb` | PostgreSQL connection string |
| `Jwt__Key` | JWT signing key (min 32 chars) |
| `Cors__AllowedOrigins__0` | Frontend URL |
| `NEXT_PUBLIC_API_BASE_URL` | API URL (frontend build-time) |
| `ANTHROPIC_API_KEY` | Optional — enables AI features |

---

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Adding a Module](docs/ADDING-A-MODULE.md)
- [Security Policy](SECURITY.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Functional Role Docs](docs/roles/) — CFO, PM, HR perspectives

---

## Honest Caveats

This is a learning project, not production-ready software:

- Some modules are stubs or thin wrappers around domain concepts I was exploring
- UI polish varies — some pages are scaffolded, others are fully built out
- I built this with AI coding agents; the architecture decisions are mine, but the line-by-line code isn't all hand-written
- No paying customers, no production workloads beyond a demo environment

If you're reviewing this for a job or collaboration: look at the test suite, the RLS implementation, and the module boundary enforcement — that's where the real engineering lives.

---

## License

[MIT](LICENSE) — use it, fork it, learn from it.