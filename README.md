# Pitbull Construction Solutions

**On-premise construction management software.** Built for commercial general contractors who are tired of paying per-seat SaaS fees for software that should run on their own servers.

Loyal. Tenacious. Won't let go. 🐕

## Stack

- **Backend:** .NET 9 / ASP.NET Core (modular monolith, CQRS with MediatR)
- **Frontend:** Next.js 15 + React 19 + Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL 17 (multi-tenant with Row-Level Security)
- **Cache:** Redis 7
- **Auth:** ASP.NET Identity + JWT (on-prem friendly, no cloud dependency)

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

## License

Proprietary. All rights reserved.
