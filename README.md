# Pitbull Construction Solutions

[![CI](https://github.com/jgarrison929/pitbull-private/actions/workflows/ci.yml/badge.svg)](https://github.com/jgarrison929/pitbull-private/actions/workflows/ci.yml)
[![.NET](https://img.shields.io/badge/.NET-9.0-512BD4)](https://dotnet.microsoft.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/tests-1949%20passing-success)](tests/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](LICENSE)

**Cloud-native construction management software.** Built for commercial general contractors who need unified project management without the complexity of managing multiple SaaS tools.

Loyal. Tenacious. Won't let go. 🐕

---

## Current Status

**Alpha 1 "Field Usable"** (Target: March 15, 2026)
- ✅ **Alpha 0 Complete** (Feb 7, 2026 - 14 days early)
- ✅ **Foundation:** Core auth, multi-tenancy, CQRS architecture, direct service injection
- ✅ **Security:** Rate limiting, request size limits, JWT auth, RLS policies, HSTS, security headers
- ✅ **Testing:** 1,949 tests passing (1,686 unit + 263 integration) — 100% controller coverage
- ✅ **CI/CD:** GitHub Actions, automated testing, Docker builds, vulnerability scanning
- ✅ **Modules:** Projects, Bids, RFIs, TimeTracking, Employees, Contracts, Equipment
- ✅ **Multi-Company:** Single tenant, multiple legal entities with compound RLS (TenantId + CompanyId)
- ✅ **Frontend:** Next.js 16 dashboard with charts, print views, dark mode, command palette
- ✅ **Deployment:** Railway auto-deploy from main, health checks, response compression
- ✅ **RBAC:** Role-based access control with Admin, Manager, Supervisor, User roles
- ✅ **AI Insights:** Claude-powered project health analysis 🤖
- ✅ **Job Costing:** Labor cost calculator, cost rollup reports, Vista export, phase tracking
- 📋 **Next:** Mobile-first time entry, foreman batch entry, pay period workflows

**Recent Wins (Feb 17-19, 2026):**
- **🚀 50+ PRs merged in 48 hours** — massive polish sprint covering security, UX, and infrastructure
- **📧 Resend Email:** Transactional email (verification, reset, invites) via example.com domain
- **🔄 CAP Event Bus:** Migrated from MassTransit (commercial license) to DotNetCore.CAP (MIT)
- **🤖 AI Context Awareness:** Chat detects current page, injects relevant system context
- **🛡️ Security Hardening:** SQL injection fix, API error message leak prevention, per-user AI rate limits
- **📊 Dashboard Overhaul:** Quick actions, activity feed, KPI cards, 16 loading skeletons
- **📋 Breadcrumbs + Navigation:** 22 pages standardized, sidebar reordered to workflow sequence
- **🧪 1,949 tests passing** (1,686 unit + 263 integration), 0 build warnings, 0 lint warnings
- **📄 CSV Exports:** All report pages (labor, profitability, equipment) export to CSV
- **🎨 Dark Mode + Accessibility:** Consistent theming, ARIA labels, keyboard shortcuts

## Stack

- **Backend:** .NET 9 / ASP.NET Core (modular monolith, CQRS with direct services)
- **Frontend:** Next.js 16 + React 19 + Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL 17 (multi-tenant with Row-Level Security + compound company isolation)
- **Cache:** Redis 7
- **Auth:** ASP.NET Identity + JWT (cloud-native, multi-tenant)

## Modules

### Shipped (Alpha 0 + Alpha 1 WIP)
- **Core** - Multi-tenancy, multi-company, auth, shared kernel, equipment tracking
- **Projects** - Project management, cost codes, budgets, phases
- **ProjectManagement** - Schedule, submittals, RFIs, daily reports, meetings, tasks, documents, communications
- **Bids** - Opportunity tracking, bid management, win/loss analytics, bid-to-project conversion
- **TimeTracking** - Labor hours, phase/equipment tracking, crew entry, approval workflow, pay periods
- **Employees** - Employee management, onboarding wizard, CSV import, certifications
- **Reports** - Labor cost, profitability, equipment reports, CSV exports, Vista/Viewpoint export
- **Contracts** - Subcontracts, change orders, AIA G702/G703 payment applications, billing progress
- **AI** - Provider abstraction (OpenAI + Anthropic), context-aware chat, smart fields, per-user rate limits
- **SystemAdmin** - RBAC admin, audit log, system health, API keys, user invitations
- **Notifications** - In-app + email (Resend), notification preferences
- **ComplianceDocuments** - Compliance tracking and document management

### MVP (Planned)
- **Portal** - Subcontractor self-service portal
- **Billing** - Owner billing, invoicing, retainage release

### v2
- Safety/Compliance, HR/Workforce, Payroll, Equipment

## Quick Start

```bash
# Start infrastructure
docker compose up -d

# Run API
cd src/Pitbull.Api
dotnet run

# API docs at http://localhost:5000/swagger
# Health check at http://localhost:5000/health
```

## Architecture

```
pitbull/
├── src/
│   ├── Pitbull.Api/              # ASP.NET Core host
│   ├── Pitbull.Web/              # Next.js frontend
│   ├── Modules/
│   │   ├── Pitbull.Core/         # Shared kernel, multi-tenancy, equipment
│   │   ├── Pitbull.Projects/     # Project management, phases, budgets
│   │   ├── Pitbull.Bids/         # Bid management, win/loss analytics
│   │   ├── Pitbull.RFIs/         # RFI tracking, cost impact
│   │   ├── Pitbull.TimeTracking/ # Labor hours, approvals, pay periods
│   │   ├── Pitbull.Contracts/    # Subcontracts, change orders, pay apps
│   │   ├── Pitbull.Documents/    # Document management (planned)
│   │   ├── Pitbull.Portal/       # Sub portal (planned)
│   │   └── Pitbull.Billing/      # Billing & invoicing (planned)
│   └── Infrastructure/
│       ├── Pitbull.Email/
│       ├── Pitbull.Storage/
│       └── Pitbull.Messaging/
├── tests/
├── deploy/
└── docker-compose.yml
```

## Deployment

### Railway (Cloud)

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repo (`jgarrison929/pitbull`)
3. Add a **PostgreSQL** service from Railway's database templates
4. Add a **Redis** service from Railway's database templates
5. Create two services from the repo:

**API Service:**
- Root directory: `/` (repo root)
- Custom Dockerfile: `src/Pitbull.Api/Dockerfile`
- Set environment variables:
  - `ConnectionStrings__PitbullDb` → use Railway's `${{Postgres.DATABASE_URL}}` or construct from Postgres variables
  - `Jwt__Key` → generate a random 32+ char string
  - `Jwt__Issuer` → `pitbull-api`
  - `Jwt__Audience` → `pitbull-client`
  - `Cors__AllowedOrigins__0` → your frontend Railway URL

**Web Service:**
- Root directory: `src/Pitbull.Web/pitbull-web`
- Custom Dockerfile: `src/Pitbull.Web/pitbull-web/Dockerfile`
- Build args: `NEXT_PUBLIC_API_BASE_URL` → your API Railway URL

6. Deploy! Railway auto-deploys on push to `main`.

### Self-Hosted (Docker Compose)

```bash
# Clone the repo
git clone https://github.com/jgarrison929/pitbull.git
cd pitbull

# Create environment file
cp .env.example .env
# Edit .env with your production values

# Build and start all services
docker compose -f docker-compose.prod.yml up -d

# API at http://localhost:8080
# Frontend at http://localhost:3000
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_PASSWORD` | PostgreSQL password | Yes |
| `JWT_KEY` | JWT signing key (min 32 chars) | Yes |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins | Yes (prod) |
| `NEXT_PUBLIC_API_BASE_URL` | API URL for frontend (build-time) | Yes |
| `ASPNETCORE_ENVIRONMENT` | `Development` or `Production` | No (defaults to Production in Docker) |
| `ANTHROPIC_API_KEY` | API key for Claude AI features | No (AI features disabled if not set) |

## AI Features 🤖

Pitbull includes AI-powered project insights using Claude:

**Project Health Analysis** (`GET /api/projects/{id}/ai-summary`)

Returns:
- **Health Score** (0-100) with status category (Excellent/Good/AtRisk/Critical)
- **Executive Summary** - Natural language overview of project status
- **Highlights** - What's going well
- **Concerns** - Potential issues to address
- **Recommendations** - Actionable next steps
- **Key Metrics** - Hours logged, labor costs, budget utilization, pending approvals

The AI analyzes:
- Project details (name, dates, budget, status)
- Time entries (hours logged, labor costs, trends)
- Employee assignments (who's working on it)
- Approval workflow status (pending time entries)
- Budget utilization (actual vs planned)

To enable: Set `ANTHROPIC_API_KEY` environment variable with your Anthropic API key.

## Documentation

- [Contributing Guide](CONTRIBUTING.md) - How to contribute to this project
- [Security Policy](.github/SECURITY.md) - Security practices and vulnerability reporting
- [Architecture Docs](docs/architecture/) - System design and technical decisions
- [Deployment Guide](docs/deployment/) - Deployment instructions and configuration
- [API Reference](http://localhost:5000/swagger) - Interactive API documentation (when running locally)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for:

- Development environment setup
- Code style and standards
- Testing requirements
- Pull request process

## Security

Found a security vulnerability? Please report it responsibly. See our [Security Policy](.github/SECURITY.md) for details.

## License

Proprietary. All rights reserved.

