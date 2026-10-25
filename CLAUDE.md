# CLAUDE.md — Pitbull Construction Solutions

Grounded guide for AI coding agents working in this repo.

**Prefer truth over polish.** Label metric proxies honestly. Never invent executive KPIs, green “all clear” overlays, or fake % complete.

**Session / version workflow is canonical in [`AGENTS.md`](AGENTS.md)** — read that first for live roadmap links, demo roles, stamp rules, and ci-gate. Do not re-derive the version ladder in chat.

---

## What this product is

Construction **project controls** platform for mid-size heavy-civil and commercial contractors. The **live product** is the rebuild in **`v5/`** (Next.js + Drizzle + PostgreSQL): estimate → budget → field daily plan/report → cost and earned value → change orders, on one data model. Trust bar and spine: [`docs/v5/fresh-start-plan.md`](docs/v5/fresh-start-plan.md). Live roadmap: [`docs/roadmap.md`](docs/roadmap.md).

The legacy **3.8.2** modular monolith under `src/` is **frozen** at tag `legacy-3.8.2-final` (security fixes only; no CI). Do not treat it as the shipped demo.

---

## Stack (live — verify in `v5/`)

| Layer | Technology |
|-------|------------|
| App | Next.js 16, React 19, Tailwind 4, shadcn/ui — one service under `v5/` |
| Data | PostgreSQL 17, Drizzle ORM |
| Demo auth | Role cards on `/login`; per-visitor sandboxes |
| Deploy | Railway (see `deploy/RAILWAY-*.md`); v5 is what staging/production serve |

**Versioning:** keep root `VERSION` and `v5/package.json` aligned. In-app `/changelog` and `/status` read `v5/src/content/changelog.ts`. Root `CHANGELOG.md` is primarily legacy 3.x history.

Do not hardcode route/test counts or “zero issues” claims — they rot. Prefer `docs/roadmap.md`, the in-app changelog, and source.

---

## Settled decisions — still apply (do not relitigate)

| Decision | Chosen | Rejected / avoid | Why |
|----------|--------|------------------|-----|
| Product shape | One coherent project-controls spine | Breadth without a closed loop | Trust bar; see fresh-start plan |
| Live app | `v5/` modular Next.js app | Treat frozen `src/` monolith as live | Rebuild for demo-able truth |
| Time | UTC everywhere | Unspecified local wall-clock in DB | Avoid ambiguous timestamps |
| Money | Integer cents in v5 math / `decimal(18,2)` where legacy remains | Narrow float money | Construction contract scale |
| Branching | Feature branch → PR → `main` | Long-lived `develop` | Single integration branch |
| Merge gate | `ci-gate`; Verify/Watch merges | Builders enabling auto-merge | Human verify owns ship |
| Field UX | Phone = capture + glance + filtered drill | Client-side portfolio/ledger aggregation | Honest mobile |
| Metrics | Labeled proxies / InsufficientData | Invented KPIs or default-green | Truth over polish |

**Legacy-only settled decisions** (frozen `src/` — do not apply as v5 defaults): modular .NET monolith + CAP outbox, controllers inject `I*Service` (no MediatR), EF `HasConversion<string>()` for enums, Hangfire. See historical [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) if you must touch legacy code.

---

## Where truth lives

| Source of truth | Secondary / historical |
|-----------------|------------------------|
| `v5/`, [`docs/roadmap.md`](docs/roadmap.md), [`docs/v5/fresh-start-plan.md`](docs/v5/fresh-start-plan.md), [`docs/v5/specs/`](docs/v5/specs/) | [`docs/roadmap-5.0.0.md`](docs/roadmap-5.0.0.md) (M0–M6 history) |
| Root `VERSION` + `v5/package.json` + `v5/src/content/changelog.ts` | Root `CHANGELOG.md` (legacy 3.x) |
| Live Railway: `deploy/RAILWAY-*.md` | Older notes under `docs/deployment/*` |
| | Archives (not live): `docs/340-pm-arc/*`, `docs/roadmap/pm-nextgen-3.4-to-4.0.md`, `docs/260712/*`, `docs/architecture/*`, most of `docs/specs/*` |

**Agent session rules:** [`AGENTS.md`](AGENTS.md).

---

## Repo layout

```
v5/                            # Live product (Next.js + Drizzle)
docs/                          # Roadmap, v5 plan/specs, archives
deploy/                        # Railway setup / demo notes
scripts/                       # Tooling (screenshots, preflight, …)
src/                           # Frozen legacy 3.8.2 monolith (tag legacy-3.8.2-final)
tests/                         # Legacy .NET tests (frozen)
e2e/                           # Legacy Playwright (frozen; no CI)
```

### v5 shape (orient here)

| Area | Responsibility |
|------|----------------|
| `v5/src/app/` | App Router pages (`/login`, `/app`, jobs, status, changelog, roadmap) |
| `v5/src/server/` | Server actions / domain writes (plans, EV, change orders, sandboxes) |
| `v5/src/db/` + `v5/drizzle/` | Schema and SQL migrations |
| `v5/src/seed/` | Deterministic demo seed |
| `v5/src/lib/` | Shared math and helpers (budget, EV, assistant routing) |
| `v5/tests/` | Playwright e2e / visual |

Legacy modules under `src/Modules/` (Projects, Billing, TimeTracking, …) describe the **frozen** app only.

---

## v5 patterns

- Prefer server-side data access through existing `v5/src/server/` and Drizzle helpers; do not invent a parallel API host for new product work.
- Demo login is **role cards** + sandboxes (`v5/src/app/login/`, `v5/src/server/sandbox.ts`) — not the legacy `demo-role-login` endpoint.
- Assistant actions must stay **typed and deterministic** where the product already does; refuse unknown jobs by name; never silently swap entities.
- Phone: capture + glance + filtered drill; no client-side portfolio aggregation.
- Migrations: add carefully under `v5/drizzle/`; avoid colliding migration numbers claimed by open slices (see [`docs/v5/specs/README.md`](docs/v5/specs/README.md)).

### Legacy patterns (frozen `src/` only)

- Controllers: `I*Service` injection; **do not add MediatR**.
- Multi-tenancy: JWT tenant + PostgreSQL RLS `app.current_tenant`; company scoping via `ICompanyScoped`.
- Soft-delete and `AsNoTracking()` conventions as in historical BEST-PRACTICES / ARCHITECTURE docs.

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
| **Daily report / daily plan** | Field day record / planned work for a crew |
| **Cost / phase codes** | Job-cost structure; do not invent codes ad hoc |
| **CPI / SPI / EAC / EV / PV / AC** | Earned-value terms — use the product’s formulas; do not invent |

**v5 core loop (live):** estimate → approve to original/current budget → field plan/report → earned value / forecasts → change orders revise current budget.

**Legacy core flows** (frozen app): bid → project → subcontracts/SOV → billing; time → payroll; RFI/submittal → CO. Useful context only — not the live demo spine.

---

## Demo & safety

- **Live:** role-card login and sandboxes on `/login` (see persona table in [`AGENTS.md`](AGENTS.md)).
- **Legacy:** `Demo:Enabled` + `demo-role-login` + `DemoRestrictionMiddleware` — historical only.
- **Never commit secrets.** Railway/env secrets stay on the platform or local untracked config.

---

## AI trust boundary

In-app assistant / AI is **assistive only**:

- Suggestions and typed actions must not invent cost or % complete.
- Prefer explicit user confirmation for consequential writes; match existing v5 action patterns.
- Historical field-AI specs under `docs/specs/mobile-ai-intelligence.md` describe the **frozen** app.

---

## Commands (repo-relative)

```bash
# Live product (v5)
cd v5
npm ci
npm run db:prepare          # needs DATABASE_URL
npm run dev
npm run lint && npm run typecheck && npm test
npm run build && npm run e2e

# Legacy (frozen — only when intentionally working in src/)
dotnet build src/Pitbull.Api/Pitbull.Api.csproj
dotnet test tests/Pitbull.Tests.Unit/
```

---

## Specs & help

- **v5 increments:** `docs/v5/specs/<name>.md` — index in [`docs/v5/specs/README.md`](docs/v5/specs/README.md).
- Legacy specs: `docs/specs/` (archive-oriented; see [`docs/specs/README.md`](docs/specs/README.md)).
- Update honest UI copy in the **same PR** when flows change.

---

## Anti-patterns

| Don’t | Do instead |
|-------|------------|
| Treat `src/` or 3.8.x stamps as the live product | Work in `v5/`; versions are **5.x** |
| Reopen `docs/340-pm-arc/*` or `docs/260712/*` as live | Live arc: `docs/roadmap.md` + `docs/v5/*` |
| Mislabel Pitbull as a general accounting suite | Call it a **project controls** platform |
| Invent executive KPIs or default-green status | Honest empty / InsufficientData / labeled proxies |
| Enable auto-merge as a builder | Leave merge to Verify/Watch after `ci-gate` |
| Client-side portfolio/ledger aggregation on phone | Server filters, slim DTOs, drill links |
| Commit secrets | Platform env + local untracked config |
| Add **gstack** (install gates, skill routing) | Repo docs + normal agent tools — gstack is not part of this project |
| Add MediatR to legacy controllers | Inject `I*Service` (legacy only) |

---

## Explicit non-requirements

- **No gstack.** No global install check, no `~/.claude/skills/gstack` dependency, no hooks that block work on missing gstack.
- No vanity status boards in this file (“0 vulnerabilities”, “0 open issues”, “100% complete roadmap”).
- No requirement to rewrite every historical design note in `docs/architecture/*` or `docs/260712/*` — archive banners are enough unless a file is still linked as live.

When in doubt: **read the code and the linked docs; prefer a smaller truthful change over a polished wrong one.**
