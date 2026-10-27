# Agent instructions — Pitbull Construction Solutions

Construction **project controls** platform. The live product is **`v5/`** (Next.js + Drizzle + PostgreSQL). The legacy 3.8.2 monolith and its browser tests were removed from this tree; recover that source from tag `legacy-3.8.2-final`. Prefer **truth over polish**: label metric proxies honestly; never invent executive KPIs.

Deeper orientation (settled decisions that still apply, domain glossary, anti-patterns): [`CLAUDE.md`](CLAUDE.md). Session/version rules in **this** file win on conflict.

## Stack (live — verify in `v5/`)

| Layer | Technology |
|-------|------------|
| App | Next.js 16, React 19, Tailwind 4, shadcn/ui — single deployable under `v5/` |
| Data | PostgreSQL 17, Drizzle ORM (`v5/drizzle/`, `v5/src/db/`) |
| Demo auth | Role cards on `/login` → per-visitor sandbox (capped, 24 h TTL, Reset demo) |
| Version | Root `VERSION` + `v5/package.json` (keep aligned) · in-app notes in `v5/src/content/changelog.ts` · root `CHANGELOG.md` is mostly legacy 3.x history |
| Deploy | Railway staging tracks `main`; production via tagged promote — see `deploy/RAILWAY-*.md` and `docs/v5/fresh-start-plan.md` |

**Do not** treat the removed 3.8.2 host as the live app. Those patterns matter only when reading the tag `legacy-3.8.2-final`.

## Demo (v5)

On `/login`, pick a role card — no password. Each visitor gets a private sandbox of the seeded Summit Highway & Bridge company.

| Role key | Seed name | Title |
|----------|-----------|-------|
| `executive` | Elena Brooks | VP Operations |
| `pm` | Marcus Lee | Project Manager |
| `superintendent` | Ray Dominguez | Superintendent |
| `foreman` | Luis Ortega | Foreman, Bridge Crew 2 |

Proof after deploy: [`.cursor/skills/verify-v5/SKILL.md`](.cursor/skills/verify-v5/SKILL.md) (`verify-v5`).

**Historical (legacy only):** Explore-as-role and the six frozen demo personas (CEO / CFO / PM / Superintendent / Estimator / Contract Admin) lived in the removed 3.8.2 app. Do not document them as the live demo.

## Docs truth

| Source of truth | Secondary / archive |
|-----------------|---------------------|
| `v5/`, `docs/roadmap.md`, `docs/v5/fresh-start-plan.md`, `docs/v5/specs/*` | `docs/roadmap-5.0.0.md` (5.0.0 milestone history; superseded as the live pointer) |
| Root `VERSION`, `v5/package.json`, `v5/src/content/changelog.ts` | Root `CHANGELOG.md` (legacy 3.x Keep a Changelog) |
| Live Railway notes: `deploy/RAILWAY-*.md` (see v5 caveats in those files) | Older multi-env notes in `docs/deployment/*` |
| Feature specs for v5 increments: `docs/v5/specs/` | Legacy product specs: `docs/specs/*` · band archive: `docs/specs/product-bands/` |
| | **Historical archives (not live):** `docs/340-pm-arc/*`, `docs/roadmap/pm-nextgen-3.4-to-4.0.md`, `docs/260712/*` |

## Required reading by task type

| Task | Read first |
|------|------------|
| Any v5 / 5.0.x ship | [`docs/roadmap.md`](docs/roadmap.md) + matching increment under [`docs/v5/specs/`](docs/v5/specs/) · trust bar: [`docs/v5/fresh-start-plan.md`](docs/v5/fresh-start-plan.md) |
| Version / stamp rules | Root `VERSION` ↔ `v5/package.json` ↔ `v5/src/content/changelog.ts` (see Version bumps below) |
| Verify a deploy | [`.cursor/skills/verify-v5/SKILL.md`](.cursor/skills/verify-v5/SKILL.md) |
| Mobile / field UX (v5) | Increment spec + phone checks in verify-v5 (capture + glance; no client-side portfolio aggregation) |
| CI | `.github/workflows/ci.yml` (`ci-gate`) |
| Legacy 3.8.2 history | Tag `legacy-3.8.2-final` · historical [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · do not reopen as live product work |

## Merging PRs (ci-gate)

- `main` requires one check, **`ci-gate`** (`.github/workflows/ci.yml`).
- **Builders do not enable auto-merge** and do not merge. Open the PR; **Verify / Watch** owns merge after PASS. After Verify PASS, do not rebase or force-push.
- `ci-gate` fails if any job in its `needs` failed or was cancelled. Its run summary lists the failing jobs and steps.
- Required (in the gate): Detect changes and the v5 job (lint, typecheck, unit tests, build, Playwright smoke).
- The v5 job runs on every push to `main` and on PRs that touch `v5/**` or `.github/workflows/ci.yml`. Other PRs skip it, and `ci-gate` still reports.
- The legacy 3.8.2 app was removed from this tree (tag `legacy-3.8.2-final`). It has no CI. Dependabot tracks `v5/` and GitHub Actions only.
- New required job: add it to `ci-gate.needs`. Advisory job: leave it out. Never put job names in the ruleset.
- Dependabot opens weekly update PRs for `v5/` npm packages and GitHub Actions (`.github/dependabot.yml`). No workflow auto-merges them; they go through `ci-gate` and Verify like any other PR. Feature builders still do not turn on auto-merge themselves.
- Emergency revert: repo admins can bypass the ruleset.

## Version bumps

Public versions are **`5.<feature>.<increment>`** (see [`docs/roadmap.md`](docs/roadmap.md)).

On a user-visible v5 ship:

1. Bump **`v5/package.json`** `version` and add the matching entry at the top of **`v5/src/content/changelog.ts`** (in-app `/changelog` and `/status` read these).
2. Keep root **`VERSION`** equal to `v5/package.json` (same story on `/status` and release tags).
3. Tag `v5.X.Y` only through the release process when promoting production — do not invent parallel 3.8.x stamps for live work.

Root `CHANGELOG.md` remains the Keep a Changelog file for the **legacy** 3.x line; do not pretend it is the v5 product changelog.

**Historical (do not use as next stamps):**

- PM next-gen 3.4→4.0 / product **3.8.x** — archive under `docs/340-pm-arc/` and `docs/roadmap/pm-nextgen-3.4-to-4.0.md`
- 3.0.0 program — archive under `docs/260712/` (ended **2.22.2** → runway → **3.0.0**)

## Session workflow (canonical — do not re-derive in chat)

### Live: Pitbull v5 / 5.0.x → 5.1+

| Doc | Purpose |
|-----|---------|
| [`docs/roadmap.md`](docs/roadmap.md) | Live roadmap: shipped 5.0.0–5.0.2, next increments, later phases |
| [`docs/v5/fresh-start-plan.md`](docs/v5/fresh-start-plan.md) | Trust bar, closed-loop spine, positioning |
| [`docs/v5/specs/`](docs/v5/specs/) | Increment specs (e.g. 5.0.3, 5.1.0…) |
| [`docs/roadmap-5.0.0.md`](docs/roadmap-5.0.0.md) | Historical 5.0.0 M0–M6 detail (not the live pointer) |
| [`.cursor/skills/verify-v5/SKILL.md`](.cursor/skills/verify-v5/SKILL.md) | Staging/production proof |

### Historical archives (complete / superseded — do not reopen as live)

| Doc | Purpose |
|-----|---------|
| [`docs/340-pm-arc/`](docs/340-pm-arc/) + [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](docs/roadmap/pm-nextgen-3.4-to-4.0.md) | Legacy PM next-gen 3.4→4.0 program (frozen with 3.8.2) |
| [`docs/260712/`](docs/260712/) | Completed 3.0.0 program |
| [`docs/specs/product-bands/`](docs/specs/product-bands/) | Legacy band specs for the 3.x arcs |
| [`docs/roadmap/post-3.0-product-bands.md`](docs/roadmap/post-3.0-product-bands.md) | Parking lot from the 3.x era |

## Mobile / performance rules (still apply)

- Phone = **capture + glance + filtered drill** — **no client-side ledger / portfolio aggregation**
- Prefer server pagination, slim payloads, list virtualization
- v5 ships responsive phone views in the demo; prove them with verify-v5 phone checks

## Specs

- **v5 user-facing increments:** write/update `docs/v5/specs/<version>-<slug>.md` before (or with) code — see [`docs/v5/specs/README.md`](docs/v5/specs/README.md)
- Legacy `docs/specs/` remains for historical 3.x features; agent-ready bar notes there are archive-oriented — see [`docs/specs/README.md`](docs/specs/README.md)
- Update in-app help / honest empty copy in the **same PR** when flows change

## Safety

- Demo sandboxes are isolated and resettable; never point demo tooling at production data stores you do not own
- Never commit secrets; Railway env via platform config
