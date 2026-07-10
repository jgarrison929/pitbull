# Pitbull Construction Solutions — Documentation

## Document organization

| Path | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Living system architecture (keep current) |
| `ROLE-EXPERIENCE.md` | Demo personas → home dashboards → metrics |
| `ROADMAP-2.1.md` | v2.1.0 release intent |
| `DEMO-COMPANY-PROFILES.md` | Summit multi-company demo archetypes |
| `BEST-PRACTICES.md` | Coding patterns (**services-first**, not MediatR controllers) |
| `ADDING-A-MODULE.md` | How to add a module |
| `WORKFLOW-EVALUATION-MATRIX.md` | Lifecycle / E2E evidence |
| `architecture/` | **Frozen Alpha design notes** (Feb 2026) — see `architecture/README.md`; living overview is `ARCHITECTURE.md` |
| `deployment/` | Historical Railway multi-env notes — **live setup is `deploy/`** |
| `security/` | Access control, RLS, IR |
| `specs/` | Active product specs |
| `archive/` | **Not product truth** — historical plans/reviews |

## Document lifecycle

- **Permanent docs** (ARCHITECTURE, ROLE-EXPERIENCE, security policies) → update when code ships  
- **Specs** → archive or mark shipped when done  
- **Archive** → context only; never treat as current roadmap  

## Current codebase snapshot (v2.0.0+ / mid-2026)

| Fact | Value |
|------|--------|
| Product version | See root `VERSION` (**2.2.1** — changelog timestamps + incremental release stamps) |
| Stack | .NET 10, EF Core 10, Next.js 16, React 19, PostgreSQL 17, Redis 7 |
| Modules | 14 under `src/Modules/` |
| Controllers | ~99 under `src/Pitbull.Api/Controllers` |
| Pattern | Controllers → `I*Service` (no MediatR in controllers) |
| Jobs | Hangfire |
| Messaging | DotNetCore.CAP (PostgreSQL outbox + Redis) |
| Deploy | Railway from `main` — **`deploy/RAILWAY-SETUP.md`**, `deploy/RAILWAY-DEMO.md` |
| Demo | `Demo:Enabled` → Explore as role on `/login` (CEO/CFO/PM/Estimator) |

**Settled facts (do not relitigate):**

- Modular monolith + CAP (not MassTransit)  
- No MediatR in controllers  
- Decimal(18,2) for money; UTC DateTimes  
- Tenant + company isolation via RLS  
- `docs/archive/**` is historical  

Always verify claims against `src/`, `CHANGELOG.md`, and tests.

---

*Refreshed for v2.2.1 (changelog publishedAt + architecture folder hygiene).*
