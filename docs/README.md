# Pitbull Construction Solutions — Documentation

## Document organization

| Path | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Living system architecture |
| `ROLE-EXPERIENCE.md` | Personas → home dashboards → metrics |
| `ROADMAP-2.1.md` | **Shipped** v2.1 workstream archive (not an active roadmap) |
| `DEMO-COMPANY-PROFILES.md` | Multi-company demo archetypes |
| `BEST-PRACTICES.md` | Coding patterns (services-first controllers) |
| `ADDING-A-MODULE.md` | How to add a module |
| `WORKFLOW-EVALUATION-MATRIX.md` | Lifecycle / E2E evidence |
| `architecture/` | Early design notes — see `architecture/README.md` |
| `deployment/` | Older Railway notes — **live setup is `deploy/` at repo root** |
| `security/` | Access control, RLS, incident response |
| `specs/` | Product specs |

## Lifecycle

- Update permanent docs (`ARCHITECTURE`, `ROLE-EXPERIENCE`, security) when code ships  
- Mark specs shipped or remove when complete  
- Prefer `CHANGELOG.md` + `src/` over narrative docs for delivery status  

## Codebase snapshot

| Fact | Value |
|------|--------|
| Product version | Root `VERSION` |
| Stack | .NET 10, EF Core 10, Next.js 16, React 19, PostgreSQL 17, Redis 7 |
| Modules | 14 under `src/Modules/` |
| Controllers | ~99 under `src/Pitbull.Api/Controllers` |
| Pattern | Controllers → `I*Service` |
| Jobs | Hangfire |
| Messaging | DotNetCore.CAP (PostgreSQL outbox + Redis) |
| Deploy | Railway from `main` — `deploy/RAILWAY-SETUP.md` |
| Demo | `Demo:Enabled` → Explore as role on `/login` |

**Settled architecture choices:** modular monolith + CAP; no MediatR in controllers; `decimal(18,2)` for money; UTC timestamps; tenant + company isolation via RLS.
