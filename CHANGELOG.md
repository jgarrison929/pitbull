# Changelog

All notable changes to Pitbull Construction Solutions are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Planned

- Contract management module
- Document management module
- Billing/invoicing module
- Client portal
- Domain event dispatching via MediatR
- Subdomain-based tenant resolution
- CreatedBy/UpdatedBy audit field auto-population

---

## [0.1.0] - 2026-01-xx

Initial feature-complete MVP for construction project and bid management.

### Authentication & Multi-Tenancy

- **JWT authentication** with login and registration endpoints
- **Multi-tenant architecture** with shared database, shared schema model
- Tenant resolution from JWT claims and `X-Tenant-Id` header
- Automatic `TenantId` stamping on entity creation
- **PostgreSQL Row-Level Security (RLS)** policies for database-level tenant isolation
- Parameterized tenant SET to prevent SQL injection
- JWT returns 401 (not 302) on protected endpoints

### Projects Module

- Full CRUD (create, read, update, soft delete) for construction projects
- **Server-side pagination** with configurable page size
- Project detail view with phases, budgets, and status tracking
- Project types: Commercial, Residential, Infrastructure, Industrial, Renovation
- Project status workflow: Planning, Pre-Construction, Active, On Hold, Completed, Cancelled
- Client information fields (name, email, phone)
- Contract amount and budget tracking

### Bids Module

- Full CRUD for bids/estimates
- **Bid line items** with quantity, unit price, and calculated totals
- **Server-side pagination** with status filtering and search
- Bid status workflow: Draft, Submitted, Under Review, Won, Lost, Withdrawn
- Bid-to-project conversion (won bids only, prevents duplicate conversion)
- Estimated value tracking and bid numbering

### API Infrastructure

- **Rate limiting** on auth and API endpoints to prevent abuse
- **Correlation ID middleware** for request tracing across services
- **Global exception handling** with structured error responses and trace IDs
- **Deep health checks** with database connectivity verification
- Consistent error response format (`{ error, code }`)
- **Serilog** structured logging

### Frontend

- **Next.js** App Router with TypeScript
- **Mobile-responsive UI** audit and fixes across all views
  - Minimum 375px viewport support (iPhone SE)
  - Touch-friendly tap targets (44px minimum)
  - Collapsible navigation on small screens
  - Responsive tables and card layouts
- **Dashboard with real statistics** (project counts, bid win rates, contract totals)
- Project list, detail, and create/edit views
- Bid list, detail, and create/edit views with line item management
- **shadcn/ui** component library with Tailwind CSS
- Auth context with automatic token management
- API client with auto-auth headers and 401 redirect handling

### Data & Database

- **Seed data generator** for realistic construction demo data
- PostgreSQL 17 with EF Core migrations (auto-apply on startup)
- snake_case table naming convention
- Soft delete with global query filters
- Audit fields (CreatedAt, UpdatedAt) auto-populated on save
- Composite unique indexes with TenantId for multi-tenant safety

### DevOps & CI/CD

- **GitHub Actions CI** pipeline for backend (.NET build + tests) and frontend (build + lint)
- **Railway deployment** with three environments: dev, staging, production
- Three-branch promotion model: `develop` -> `staging` -> `main`
- PostgreSQL 17 service container for CI integration tests

### Documentation

- Best practices and patterns guide (`docs/BEST-PRACTICES.md`)
- Module creation guide (`docs/ADDING-A-MODULE.md`)
- Team protocol (`docs/TEAM-PROTOCOL.md`)
- Quality strategy (`docs/QUALITY-STRATEGY.md`)
- Vision document (`docs/VISION.md`)
- RLS implementation documentation
- Release plan

### Known Issues

- Domain events collected but not yet dispatched (MediatR integration pending)
- `CreatedBy`/`UpdatedBy`/`DeletedBy` audit fields not auto-populated from user context
- `PagedResult<T>` defined in Projects module but used cross-module (should move to Core)
- Subdomain tenant resolution placeholder (not yet implemented)
