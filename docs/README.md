# Pitbull Construction Solutions — Documentation

**Live product:** [`v5/`](../v5/) (Next.js + Drizzle). **Live roadmap:** [`roadmap.md`](roadmap.md). **Trust bar / spine:** [`v5/fresh-start-plan.md`](v5/fresh-start-plan.md).

Prefer **truth over polish**. Root agent entrypoints: [`../AGENTS.md`](../AGENTS.md), [`../CLAUDE.md`](../CLAUDE.md).

## Live (v5 / 5.0.x)

| Path | Purpose |
|------|---------|
| [`roadmap.md`](roadmap.md) | Canonical product roadmap (shipped + next increments) |
| [`v5/fresh-start-plan.md`](v5/fresh-start-plan.md) | 5.0 trust bar, closed loop, phase map |
| [`v5/specs/`](v5/specs/) | Increment specs (`5.0.3`, `5.1.0`, …) |
| [`v5/prd/`](v5/prd/) | Feature PRDs (e.g. Schedule) before increment specs |
| [`roadmap-5.0.0.md`](roadmap-5.0.0.md) | Historical 5.0.0 M0–M6 detail (superseded as the live pointer) |
| [`../deploy/RAILWAY-*.md`](../deploy/) | Railway / demo deploy notes (v5 is what ships) |

## Document organization (mixed live + archive)

| Path | Purpose |
|------|---------|
| `ARCHITECTURE.md` | **Legacy** system architecture for frozen `src/` — not the v5 app map |
| `ROLE-EXPERIENCE.md` | Personas / home UX (mostly legacy; verify against v5 role cards) |
| `ROADMAP-2.1.md` | **Shipped** v2.1 workstream archive |
| `DEMO-COMPANY-PROFILES.md` | Multi-company demo archetypes (legacy-oriented) |
| `mobile3.md` | Field mobile capture plan (historical fuel) |
| `pitbull-digital-twin-spec.md` | Digital twin design (not in v5 5.0 spine) |
| (removed) `BEST-PRACTICES.md` / `ADDING-A-MODULE.md` | .NET module guides; live patterns are [`../AGENTS.md`](../AGENTS.md) |
| `WORKFLOW-EVALUATION-MATRIX.md` | Lifecycle / E2E evidence (legacy era) |
| `architecture/` | Early design notes — see `architecture/README.md` (**archive**) |
| `deployment/` | Older Railway notes — **live setup is `deploy/` at repo root** |
| `security/` | Access control, RLS, incident response (verify against current deploy) |
| `specs/` | Legacy product specs + band archive — see `specs/README.md` |
| `gtm/` | Sellability / GC-tool displacement map |
| `340-pm-arc/`, `260712/`, `roadmap/pm-nextgen-*` | **Historical archives** — not live |

## Lifecycle

- Update **live** docs (`roadmap.md`, `v5/specs/*`, agent entrypoints) when v5 code ships  
- Prefer archive banners over rewriting frozen design notes  
- Prefer `docs/roadmap.md` + `v5/src/content/changelog.ts` + source over narrative “% complete”  

## Codebase snapshot

| Fact | Value |
|------|--------|
| Live product | `v5/` |
| Product version | Root `VERSION` (= `v5/package.json`, currently **5.0.x**) |
| Live stack | Next.js 16, React 19, PostgreSQL 17, Drizzle |
| Frozen legacy | `src/` + `e2e/` at tag `legacy-3.8.2-final` (no CI) |
| Deploy | Railway from `main` (staging) — `deploy/RAILWAY-SETUP.md` |
| Demo | Role cards on `/login` → per-visitor sandbox |

**Stale-doc inventory:** [`stale-docs-inventory.md`](stale-docs-inventory.md).
