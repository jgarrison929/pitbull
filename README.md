# Pitbull Construction Solutions

**Construction management software built for commercial general contractors.** Tired of paying per-seat SaaS fees for bloated platforms? Pitbull is designed to run on your own terms.

Loyal. Tenacious. Won't let go. 🐕

## Live Demo

- **API:** https://pitbull-api-production.up.railway.app
- **Web:** https://pitbull-web-production.up.railway.app

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | .NET 9 / ASP.NET Core |
| Frontend | Next.js 15 + React 19 + Tailwind CSS + shadcn/ui |
| Database | PostgreSQL 17 (multi-tenant with Row-Level Security) |
| Cache | Redis 7 |
| Auth | ASP.NET Identity + JWT |
| CQRS | MediatR with validation pipeline |
| ORM | Entity Framework Core 9 |
| Logging | Serilog |
| CI/CD | GitHub Actions |
| Hosting | Railway (cloud) / Docker Compose (self-hosted) |

## Architecture

Pitbull follows a **modular monolith** pattern. Each business domain lives in its own module with clear boundaries, but everything ships as a single deployable unit. This gives you the organizational benefits of microservices without the operational overhead.

Key architectural decisions:

- **CQRS with MediatR** for clean command/query separation
- **Multi-tenancy via Row-Level Security** at the database level, so tenant isolation is enforced by PostgreSQL itself
- **Vertical slice architecture** within each module (feature folders, not layer folders)
- **Auto-tenant creation** on user registration, so new companies can self-onboard
- **Result pattern** for explicit error handling (no exceptions for control flow)

## Modules

### Active (implemented)

- **Core** - Multi-tenancy, ASP.NET Identity, shared domain types, CQRS pipeline, validation behaviors, EF Core DbContext
- **Projects** - Full CRUD for construction projects with budgets, phases, and projections
- **Bids** - Bid tracking with line items, statuses, and the ability to convert a won bid directly into a project

### Scaffolded (coming soon)

- **Contracts** - Subcontracts, change orders, approval workflows
- **Documents** - File storage, versioning, full-text search
- **Portal** - Subcontractor self-service portal
- **Billing** - Owner billing, AIA pay apps, retainage tracking

### Infrastructure

- **Email** - Transactional email service
- **Storage** - File storage abstraction
- **Messaging** - Event/message bus

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user (auto-creates tenant) |
| POST | `/api/auth/login` | Login, returns JWT |

### Tenants
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tenants` | Create a tenant |
| GET | `/api/tenants/{id}` | Get tenant by ID |
| GET | `/api/tenants` | List tenants |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/{id}` | Get project by ID |
| GET | `/api/projects` | List projects (with filtering) |
| PUT | `/api/projects/{id}` | Update a project |
| DELETE | `/api/projects/{id}` | Delete a project |

### Bids
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bids` | Create a bid |
| GET | `/api/bids/{id}` | Get bid by ID |
| GET | `/api/bids` | List bids (with filtering) |
| PUT | `/api/bids/{id}` | Update a bid |
| POST | `/api/bids/{id}/convert-to-project` | Convert a won bid into a project |

Full Swagger docs available at `/swagger` when running locally.

## Frontend Routes

The Next.js frontend includes 10 routes across auth and dashboard layouts:

- `/login` and `/register` (auth flow)
- `/` (dashboard)
- `/projects`, `/projects/new`, `/projects/[id]` (project management)
- `/bids`, `/bids/new`, `/bids/[id]` (bid management)

Design uses dark gray backgrounds with amber (#f59e0b) accents.

## Project Structure

```
pitbull/
├── .github/
│   ├── ISSUE_TEMPLATE/         # Bug and feature request templates
│   └── workflows/ci.yml        # GitHub Actions CI pipeline
├── src/
│   ├── Pitbull.Api/            # ASP.NET Core host + controllers
│   │   ├── Controllers/        # Auth, Projects, Bids, Tenants
│   │   ├── Migrations/         # EF Core migrations
│   │   └── Dockerfile
│   ├── Pitbull.Web/
│   │   └── pitbull-web/        # Next.js 15 frontend
│   │       └── src/
│   │           ├── app/        # App Router (auth + dashboard layouts)
│   │           ├── components/ # Reusable UI components
│   │           ├── contexts/   # React contexts (auth, etc.)
│   │           └── lib/        # Utilities, API client
│   ├── Modules/
│   │   ├── Pitbull.Core/       # Shared kernel
│   │   │   ├── CQRS/           # ICommand, ValidationBehavior
│   │   │   ├── Data/           # PitbullDbContext
│   │   │   ├── Domain/         # AppUser, Tenant, BaseEntity
│   │   │   ├── Extensions/     # Service registration helpers
│   │   │   └── MultiTenancy/   # Tenant resolution, RLS
│   │   ├── Pitbull.Projects/   # Project management module
│   │   │   ├── Data/           # EF configurations
│   │   │   ├── Domain/         # Project, Phase, Budget entities
│   │   │   └── Features/       # Create, Get, List, Update
│   │   ├── Pitbull.Bids/       # Bid management module
│   │   │   ├── Data/           # EF configurations
│   │   │   ├── Domain/         # Bid, BidItem, BidStatus entities
│   │   │   └── Features/       # Create, Get, List, Update, ConvertToProject
│   │   ├── Pitbull.Contracts/  # (scaffolded)
│   │   ├── Pitbull.Documents/  # (scaffolded)
│   │   ├── Pitbull.Portal/     # (scaffolded)
│   │   └── Pitbull.Billing/    # (scaffolded)
│   └── Infrastructure/
│       ├── Pitbull.Email/      # Email service
│       ├── Pitbull.Storage/    # File storage
│       └── Pitbull.Messaging/  # Message bus
├── tests/
│   ├── Pitbull.Tests.Unit/
│   └── Pitbull.Tests.Integration/
├── deploy/
│   └── init-db.sql             # Database initialization
├── docker-compose.yml          # Local dev (PostgreSQL + Redis)
├── docker-compose.prod.yml     # Production Docker setup
├── .env.example                # Environment variable template
└── Pitbull.sln                 # Solution file
```

## Getting Started

### Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 22+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)

### Local Development

1. **Clone the repo**

```bash
git clone https://github.com/jgarrison929/pitbull.git
cd pitbull
```

2. **Start infrastructure**

```bash
docker compose up -d
```

This spins up PostgreSQL 17 and Redis 7 with health checks.

3. **Run the API**

```bash
cd src/Pitbull.Api
dotnet run
```

The API will be available at `http://localhost:5000`. Swagger docs at `http://localhost:5000/swagger`.

4. **Run the frontend**

```bash
cd src/Pitbull.Web/pitbull-web
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### Environment Variables

Copy `.env.example` to `.env` and update for your environment:

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_PASSWORD` | PostgreSQL password | Yes |
| `JWT_KEY` | JWT signing key (min 32 chars) | Yes |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins | Production |
| `NEXT_PUBLIC_API_BASE_URL` | API URL for the frontend (build-time) | Yes |
| `ASPNETCORE_ENVIRONMENT` | `Development` or `Production` | No |

## CI/CD

GitHub Actions runs on every push and PR to `main` and `develop`:

- **Backend:** Restores, builds, runs unit tests and integration tests against a real PostgreSQL 17 instance
- **Frontend:** Installs dependencies, builds, and lints

## Deployment

### Railway (Cloud)

The project is deployed on [Railway](https://railway.app) with two services:

**API Service:**
- Dockerfile at `src/Pitbull.Api/Dockerfile`
- Environment: `ConnectionStrings__PitbullDb`, `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`, `Cors__AllowedOrigins__0`

**Web Service:**
- Dockerfile at `src/Pitbull.Web/pitbull-web/Dockerfile`
- Build arg: `NEXT_PUBLIC_API_BASE_URL` pointing to the API service URL

Both auto-deploy on push to `main`.

### Self-Hosted (Docker Compose)

```bash
git clone https://github.com/jgarrison929/pitbull.git
cd pitbull

cp .env.example .env
# Edit .env with production values

docker compose -f docker-compose.prod.yml up -d
```

## Roadmap

Modules planned for upcoming development:

- [ ] **Contracts** - Subcontracts, change orders, approval workflows
- [ ] **Documents** - Cloud/local file storage, versioning, full-text search
- [ ] **Portal** - Subcontractor self-service portal
- [ ] **Billing** - Owner billing, AIA pay applications, retainage tracking
- [ ] **Timekeeping** - Field time tracking
- [ ] **Safety/Compliance** - Incident tracking, certifications
- [ ] **Equipment** - Asset tracking and maintenance

## License

Proprietary. All rights reserved.
