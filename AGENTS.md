# Agent instructions — Pitbull Construction Solutions

Construction ERP (modular monolith). Prefer **truth over polish**: label metric proxies honestly; never invent executive KPIs.

## Stack (current)

- **API:** .NET 10, ASP.NET Core, EF Core 10, PostgreSQL 17 + RLS  
- **Web:** Next.js 16, React 19, Tailwind 4, shadcn/ui  
- **Auth:** JWT + Identity roles (`Admin`/`Manager`/`Supervisor`/`User`) + RBAC **permissions** claims  
- **Pattern:** Controllers inject `I*Service` — **do not add MediatR to controllers**  
- **Version:** root `VERSION` + `CHANGELOG.md` (Keep a Changelog; ISO published timestamps)

## Demo personas (Explore as a role)

When `Demo:Enabled=true`: CEO / CFO / PM / Superintendent / Estimator / Contract Admin via `POST /api/auth/demo-role-login`.

| Key | Email | Title drives home UX |
|-----|--------|----------------------|
| ceo | ceo@demo.local | Chief Executive Officer → **executive** layout + Executive briefing |
| cfo | cfo@demo.local | Chief Financial Officer → **controller** layout |
| pm | pm@demo.local | Project Manager → **pm** layout |
| superintendent | superintendent@demo.local | Field Superintendent → **field** layout (alias key: `foreman`) |
| estimator | estimator@demo.local | Estimator → **estimator** layout |
| contractadmin | contract-admin@demo.local | Contract Administrator → **contracts** layout (alias: `ca`) — main/owner contracts, sub pay apps, insurance & project compliance |

**Persona resolution** is title-first via `RoleProfileResolver` (briefing, dashboard prefs, welcome tour). JWT includes `job_title` + `role_profile`. Identity role alone is **not** enough (Manager ≠ Executive).

## Docs truth

| Source of truth | Secondary |
|-----------------|-----------|
| `src/`, tests, `CHANGELOG.md`, `docs/ARCHITECTURE.md`, `docs/ROLE-EXPERIENCE.md` | Historical design notes under `docs/architecture/` (see its README) |
| Live Railway: `deploy/RAILWAY-*.md` | Older multi-env notes in `docs/deployment/*` |
| Session program: `docs/260712/*` (historical 3.0) | **Live arc:** `docs/roadmap/pm-nextgen-3.4-to-4.0.md` + `docs/340-pm-arc/*` · parking lot: `docs/roadmap/post-3.0-product-bands.md` |

## Required reading by task type

| Task | Read first |
|------|------------|
| Any version ship | `docs/260712/VERSION-WORKFLOW.md` + matching block in `goal-prompts.md` |
| Mobile / field UX | Spec for band + `docs/mobile3.md` + `docs/ROLE-EXPERIENCE.md` |
| Digital twin | `docs/pitbull-digital-twin-spec.md` + `docs/specs/digital-twin-phase2-implementation.md` |
| Workflow / approvals | `docs/WORKFLOW-EVALUATION-MATRIX.md` + band spec |
| Help center | `docs/specs/help-center-*.md` + `help/page.tsx` |
| CI / E2E | `docs/specs/ci-mobile-owner-smoke.md`, `e2e/fixtures/ROLE-PERSONA-MAP.md` |
| Preflight | `./scripts/preflight.ps1 -FullWeb -DotNet` before push |

## Version bumps

Per `CONTRIBUTING.md`: update `VERSION`, web `package.json`, API csproj Version props, Docker ARGs together. Stamp CHANGELOG headers with ISO date+time.

**This program (to 3.0.0):** product ends **`2.22.2`**; runway **`2.22.3`→`2.24.2`**; major **`2.24.2`→`3.0.0`**. One bump per PR. Never skip. See `VERSION-WORKFLOW.md`.

## Session workflow (canonical — do not re-derive in chat)

### Live: PM next-gen (3.4 → 4.0.0)

| Doc | Purpose |
|-----|---------|
| [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](docs/roadmap/pm-nextgen-3.4-to-4.0.md) | Epic: domains, inventory, ladder, Railway gates |
| [`docs/340-pm-arc/VERSION-WORKFLOW.md`](docs/340-pm-arc/VERSION-WORKFLOW.md) | Version rules for this arc |
| [`docs/340-pm-arc/goal-prompts.md`](docs/340-pm-arc/goal-prompts.md) | Copy-paste `/goal` prompts |
| [`docs/specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md`](docs/specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md) | First band (next stamp **3.4.1**) |
| [`docs/ci/pm-arc-deploy-safety.md`](docs/ci/pm-arc-deploy-safety.md) | Preflight + stamp + health gates |

### Historical: 3.0.0 program (complete — do not reopen)

| Doc | Purpose |
|-----|---------|
| [`docs/260712/VERSION-WORKFLOW.md`](docs/260712/VERSION-WORKFLOW.md) | Product **2.12.2→2.22.2** (~101 PRs); runway **2.22.3→3.0.0** (21 PRs) |
| [`docs/260712/plan1.md`](docs/260712/plan1.md) | Master plan + 3.0.0 release checklist |
| [`docs/260712/spec-workload.md`](docs/260712/spec-workload.md) | Spec index Arc A–E + runway |
| [`docs/260712/goal-prompts.md`](docs/260712/goal-prompts.md) | Copy-paste `/goal` prompts per version step |
| [`docs/260712/release-checklist-runway.md`](docs/260712/release-checklist-runway.md) | 2.22.3+ verification/fixes only |

## Mobile / performance rules

- **PWA-first** through 3.0.0 — no native app shell in this program  
- Phone = **capture + glance + filtered drill** — **no client-side ledger / portfolio aggregation**  
- Prefer slim DTOs (`?view=mobile`), server pagination, list virtualization  

## Specs

- User-facing features: `docs/specs/<name>.md` before code (agent-ready bar in `docs/specs/README.md`)  
- Update help in the **same PR** when flows change  

## Safety

- Demo users: `IsDemoUser` + `DemoRestrictionMiddleware` (admin GET-only, no DELETE)  
- Never commit secrets; Railway env via platform config  
