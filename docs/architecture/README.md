# Architecture design notes (`docs/architecture/`)

## Why this folder rarely changes

These files are **early Alpha design docs** (mostly Feb 2026). They capture intent for modules before/during first implementation. They are **not** the living architecture surface.

| File | Last meaningful update | Role |
|------|------------------------|------|
| `AI-ARCHITECTURE-REQUIREMENTS.md` | 2026-02 | AI provider / capability requirements (pre–.NET 10 / pre–v2) |
| `COST-CODE-DESIGN.md` | 2026-02-05 | Cost code foundation design for Alpha 0 |
| `TIME-TRACKING-DESIGN.md` | 2026-02-05 | Time tracking module design (status still says “Draft – Alpha 0”) |

**Living docs (update when structure ships):**

| Doc | Use when |
|-----|----------|
| [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | Stack, modules, tenancy, CQRS/services-first patterns |
| [`docs/ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md) | Role home UX, role-summary, KPI drills |
| [`docs/BEST-PRACTICES.md`](../BEST-PRACTICES.md) | Coding conventions |
| root [`CHANGELOG.md`](../../CHANGELOG.md) | What actually shipped, with published timestamps |
| `src/Modules/*` | Source of truth for domain models & APIs |

## Why v2.1 / v2.2 work did not touch this folder

1. **Wrong abstraction for product UX work** — Role-native homes, role-summary KPIs, and drill-through URLs are product/experience architecture documented under `ROLE-EXPERIENCE.md` and `ARCHITECTURE.md` (overview), not under frozen Alpha design specs.
2. **No process gate** — `AGENTS.md` / docs README list permanent docs as `ARCHITECTURE.md`, ROLE-EXPERIENCE, security — not `docs/architecture/*`. Agents were never required to refresh these on feature ships.
3. **Design already “done” in code** — Time tracking, cost codes, and AI shipped long ago; evolving them happens in services/controllers + CHANGELOG, not by rewriting the 2026-02 design draft.
4. **Archive culture** — Planning/design that finished moved to `docs/archive/**`; this folder kept three permanent-looking design notes that were never reclassified as historical.

## When to edit files here

- **Do** update `docs/ARCHITECTURE.md` when module boundaries, tenancy, host stack, or cross-cutting patterns change.
- **Do** add a new design note here only for a **net-new subsystem** whose domain model is not yet in `src/`.
- **Do not** treat `TIME-TRACKING-DESIGN.md` etc. as current API contracts — verify against controllers and EF entities.
- If a design note diverges badly from production, either: (a) stamp it `Status: Historical` and link to current modules, or (b) move it to `docs/archive/`.

## Current product architecture pointers (v2.2+)

- Modular monolith, .NET 10, Next.js 16, EF Core 10, CAP + Hangfire  
- Controllers → `I*Service` (no MediatR in controllers)  
- Demo role UX: `RoleProfileResolver`, `GET /api/dashboard/role-summary`, KPI drill contracts  
- Deploy: Railway from `main` — see `deploy/RAILWAY-SETUP.md`
