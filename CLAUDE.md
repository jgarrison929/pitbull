# CLAUDE.md — Pitbull Construction Solutions

Grounded guide for AI coding agents working in this repo.

**Prefer truth over polish.** Label metric proxies honestly. Never invent executive KPIs, green “all clear” overlays, or fake % complete.

**Session / version workflow is canonical in [`AGENTS.md`](AGENTS.md)** — read that first for personas, stamp rules, live roadmap links, and preflight. Do not re-derive the version ladder in chat.

---

## What this product is

Construction ERP for commercial general contractors: projects, contracts, billing (AIA), time/payroll, field PM (RFIs, submittals, schedule, daily reports), reporting, and assistive AI.

**Shape:** modular monolith — one deployable API + Next.js web app, module boundaries under `src/Modules/`.

---

## Stack (verify in repo)

| Layer | Technology |
|-------|------------|
| API | .NET 10, ASP.NET Core, EF Core 10 |
| DB | PostgreSQL 17 + RLS (`app.current_tenant`) |
| Web | Next.js 16, React 19, Tailwind 4, shadcn/ui |
| Auth | JWT + Identity roles (`Admin` / `Manager` / `Supervisor` / `User`) + RBAC **permission** claims |
| Messaging | DotNetCore.CAP (PostgreSQL outbox + Redis) |
| Cache | Redis |
| Email | Resend (optional) |
| Deploy | Railway (see `deploy/RAILWAY-*.md`); Docker Compose for self-host |

**Controller pattern:** inject `I*Service` and call it directly. **Do not add MediatR (or `IMediator`) to controllers.**

**Versioning:** root `VERSION` + `CHANGELOG.md` (Keep a Changelog; ISO published timestamps). Keep `VERSION`, web `package.json`, API csproj Version props, and Docker `ARG`s in sync per `CONTRIBUTING.md`.

Do not hardcode controller/test counts or “zero issues” claims — they rot. Prefer `CHANGELOG.md` and source.

---

## Settled decisions — do not relitigate

| Decision | Chosen | Rejected / avoid | Why |
|----------|--------|------------------|-----|
| Architecture | Modular monolith | Microservices-first | Right for team size; modules allow later extraction |
| Data access | Direct `PitbullDbContext` in services | Repository-for-everything | Less abstraction; services own use cases |
| Controllers | `I*Service` injection | MediatR in controllers | MediatR went commercial; keep HTTP thin |
| Event bus | DotNetCore.CAP | MassTransit v9+ commercial | MIT + PG outbox |
| Enums in EF | `HasConversion<string>()` | int enums | Readable in DB; reorder-safe |
| Time | UTC everywhere | Local wall-clock in DB | SaveChanges normalization; Npgsql strict UTC |
| Money | `decimal(18,2)` | Narrow precision | Large construction contracts |
| Branching | Feature branch → PR → `main` | Long-lived `develop` | Single integration branch |
| Field product | PWA-first | Native app shell (for current arcs) | See mobile rules below |

---

## Where truth lives

| Source of truth | Secondary / historical |
|-----------------|------------------------|
| `src/`, tests, `CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/ROLE-EXPERIENCE.md` | `docs/architecture/*` (frozen design notes — see its README) |
| Live Railway: `deploy/RAILWAY-*.md` | Older multi-env notes under `docs/deployment/*` |
| Live product arc: `docs/roadmap/pm-nextgen-3.4-to-4.0.md` + `docs/340-pm-arc/*` | Completed 3.0 program archive: `docs/260712/*` (do not reopen as live work) |
| Feature specs: `docs/specs/*` | Parking lot: `docs/roadmap/post-3.0-product-bands.md` |

**Agent session rules, demo personas, and stamp ladders:** [`AGENTS.md`](AGENTS.md).

---

## Repo layout

```
src/
  Pitbull.Api/                 # Host: controllers, middleware, migrations, Program.cs
  Modules/                     # Domain modules (Core, Projects, Billing, …)
  Pitbull.Web/pitbull-web/     # Next.js app
  Infrastructure/              # Email, storage, messaging (as present)
tests/
  Pitbull.Tests.Unit/
  Pitbull.Tests.Integration/
docs/                          # Architecture, specs, roadmap, role UX
deploy/                        # Railway templates and setup notes
scripts/                       # preflight.ps1 and tooling
```

### Modules (current)

| Module | Responsibility |
|--------|----------------|
| **Core** | DbContext, multi-tenancy, base entities, shared services, Result patterns |
| **Projects** | Projects, phases, cost codes, budgets |
| **Bids** | Bids and bid → project conversion |
| **Contracts** | Subcontracts, SOV, change orders |
| **Billing** | AIA G702/G703, vendors/customers, AP/AR, WIP, retention, lien waivers, POs/invoices |
| **TimeTracking** | Time entries, crew entry, approval, payroll |
| **ProjectManagement** | Schedule, RFIs, submittals, daily reports, punch lists, meetings, tasks; **jobsite twin** (spatial graph/overlays) |
| **Reports** | Labor/profitability/exports, financial statements |
| **AI** | Provider abstraction, field/chat suggestions, usage metering |
| **SystemAdmin** | Users/RBAC, API keys, settings, health |
| **Notifications** | In-app + email |
| **Documents** | Attachments / storage abstraction |
| **Portal** | External access (limited) |
| **RFIs** | Legacy; prefer ProjectManagement for new RFI work |

Module registration uses `AddPitbullModule` / `AddPitbullModuleServices` patterns. CQRS command/query types may still exist for registration/validation; **new feature logic prefers services**.

---

## Backend patterns

- **Controllers:** primary constructor + `I*Service`; `[Authorize]`; pagination via shared page types where applicable.
- **Services:** take `PitbullDbContext`, `ITenantContext`, `ICompanyContext` as needed. Reads: `AsNoTracking()`, respect soft-delete (`!IsDeleted`). Always accept `CancellationToken`.
- **Multi-tenancy (two layers):**
  1. App: tenant from JWT / middleware → session config
  2. DB: PostgreSQL RLS on `app.current_tenant`
  - Multi-company: `ICompanyScoped` + company context (compound isolation).
- **UTC:** do not store unspecified local times; rely on global SaveChanges UTC normalization and keep new code UTC-safe.
- **Migrations:** add carefully; **diff new migrations against recent ones** to avoid duplicate column/index ops when scaffolding repeatedly.
- **Errors:** prefer consistent API error shapes already used in the host; do not invent a second exception protocol.

---

## Frontend patterns

- Call the API through the shared client in `src/Pitbull.Web/pitbull-web/src/lib/api.ts` (and domain helpers under `lib/`). Do not scatter raw `fetch` with one-off auth headers.
- **Auth / home UX:** title-first persona via `RoleProfileResolver`. JWT may include `job_title` + `role_profile`. **Identity role alone is not enough** (Manager ≠ Executive layout).
- **UI:** App Router, shadcn/ui under `components/ui/`, feature components colocated by domain.
- **Mobile / field:**
  - Phone = **capture + glance + filtered drill**
  - **No client-side ledger or portfolio aggregation**
  - Prefer slim DTOs (`?view=mobile`), server pagination, list virtualization
  - PWA-first for current program arcs

---

## Construction domain (minimal)

Agents must respect GC vocabulary:

| Term | Meaning |
|------|---------|
| **Retainage / retention** | % withheld until completion / conditions met |
| **SOV** | Schedule of values — contract line breakdown |
| **AIA G702 / G703** | Pay app + continuation sheet |
| **WIP** | Work-in-progress; cost-to-cost style math — **label proxies honestly** |
| **Lien waiver** | Waiver of lien rights, often required for payment |
| **RFI** | Request for information (design/clarification) |
| **Submittal** | Shop drawings / product data for approval |
| **Change order** | Scope/price/time modification to contract |
| **Punch list** | Closeout deficiency tracking |
| **Daily report** | Field day record (weather, manpower, work) |
| **Cost / phase codes** | Job-cost structure; do not invent codes ad hoc |

**Core flows (orient, then read specs):**

1. Bid → project → subcontracts / SOV → monthly billing → retention → closeout  
2. Time entry → approval → payroll / certified payroll where required  
3. RFI / submittal → impact → change order → contract update  

For field twin overlays: unlinked / insufficient data stays **InsufficientData** — never default-green.

---

## Demo & safety

- When `Demo:Enabled=true`, explore-as-role logins via `POST /api/auth/demo-role-login` (persona table in `AGENTS.md`).
- Demo users: `IsDemoUser` + `DemoRestrictionMiddleware` (restricted mutations; no unrestricted admin DELETE paths).
- **Never commit secrets.** Railway/env secrets stay on the platform or local untracked config.

---

## AI trust boundary

Field and in-app AI are **assistive only**:

- Suggestions must not auto-post progress or daily reports (`AutoApplied=false`; explicit user Apply).
- Label suggestions for review; empty/scaffold when unconfigured — do not invent cost or % complete.
- Offline: field AI disabled with honest copy.
- Specs: `docs/specs/mobile-ai-intelligence.md`; overview in `docs/ARCHITECTURE.md` (AI trust section).

---

## Commands (repo-relative)

```bash
# Backend
dotnet build src/Pitbull.Api/Pitbull.Api.csproj
dotnet test tests/Pitbull.Tests.Unit/
dotnet test tests/Pitbull.Tests.Integration/   # needs PostgreSQL

# Frontend
cd src/Pitbull.Web/pitbull-web
npm ci
npm run dev
npx next build
npm run lint

# Before push (when shipping)
./scripts/preflight.ps1 -FullWeb -DotNet
```

Migrations: from API project with the repo’s usual `dotnet ef` workflow (migrations live under the API host). Prefer matching existing CONTRIBUTING / BEST-PRACTICES notes over inventing a new path.

---

## Specs & help

- User-facing features: write/update `docs/specs/<name>.md` before (or with) code when the change is product-visible. Agent-ready bar: `docs/specs/README.md`.
- Update in-app help in the **same PR** when flows change.

---

## Anti-patterns

| Don’t | Do instead |
|-------|------------|
| Add MediatR to controllers | Inject `I*Service` |
| Add **gstack** (install gates, PreToolUse hooks, skill routing, “gstack required”) | Use repo docs + normal agent tools. **gstack is not part of this project and must not be reintroduced** |
| Invent executive KPIs or default-green twin state | Honest empty / InsufficientData / labeled proxies |
| Treat `docs/architecture/*` as living architecture | `docs/ARCHITECTURE.md` + source |
| Reopen completed `docs/260712/*` as the live program | Live arc: `docs/roadmap/pm-nextgen-3.4-to-4.0.md` + `docs/340-pm-arc/*` |
| Client-side portfolio/ledger aggregation on phone | Server filters, slim DTOs, drill links |
| Commit secrets or bypass demo restrictions “for convenience” | Platform env + middleware rules |
| Skip help/spec updates for user-visible flow changes | Spec + help in the same PR |

---

## Explicit non-requirements

- **No gstack.** No global install check, no `~/.claude/skills/gstack` dependency, no hooks that block work on missing gstack, no skill-routing tables that mandate gstack commands.
- No requirement for external “agent team” skill packs under `.claude/skills/` unless those files exist in the tree and the task needs them.
- No vanity status boards in this file (“0 vulnerabilities”, “0 open issues”).

When in doubt: **read the code and the linked docs; prefer a smaller truthful change over a polished wrong one.**
