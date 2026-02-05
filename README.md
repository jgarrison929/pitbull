# Pitbull Construction Solutions

**Cloud-native construction management software.** Built for commercial general contractors who need unified project management without the complexity of managing multiple SaaS tools.

Loyal. Tenacious. Won't let go. 🐕

## Stack

- **Backend:** .NET 9 / ASP.NET Core (modular monolith, CQRS with MediatR)
- **Frontend:** Next.js 15 + React 19 + Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL 17 (multi-tenant with Row-Level Security)
- **Cache:** Redis 7
- **Auth:** ASP.NET Identity + JWT (cloud-native, multi-tenant)

## Modules

### MVP
- **Core** - Multi-tenancy, auth, shared kernel
- **Projects** - Project management, cost codes, budgets
- **Bids** - Opportunity tracking, bid management, win/loss analytics
- **Contracts** - Subcontracts, change orders, approval workflows
- **Documents** - Cloud/local storage, versioning, full-text search
- **Portal** - Subcontractor self-service portal
- **Billing** - Owner billing, AIA pay apps, retainage tracking

### v2
- Timekeeping, Safety/Compliance, HR/Workforce, Payroll, Equipment

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
│   │   ├── Pitbull.Core/         # Shared kernel
│   │   ├── Pitbull.Projects/     # Project management
│   │   ├── Pitbull.Bids/         # Bid management
│   │   ├── Pitbull.Contracts/    # Subcontracts & COs
│   │   ├── Pitbull.Documents/    # Document management
│   │   ├── Pitbull.Portal/       # Sub portal
│   │   └── Pitbull.Billing/      # Billing & pay apps
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

## License

Proprietary. All rights reserved.
