# Stale docs inventory (v5 / 5.0.x truth pass)

**Status:** Snapshot for the docs-truth rewrite. Prefer **archive labels** over rewriting every frozen note.  
**Live pointers:** [`roadmap.md`](roadmap.md) · [`v5/fresh-start-plan.md`](v5/fresh-start-plan.md) · [`v5/specs/`](v5/specs/) · root [`AGENTS.md`](../AGENTS.md) / [`CLAUDE.md`](../CLAUDE.md).

This is not a claim that every listed file was edited in the same PR. It is a map of what remains stale relative to the live product.

## Labeled archive (OK if left as-is once bannered)

| Path | Notes |
|------|--------|
| `docs/260712/*` | Completed 3.0.0 program — do not reopen |
| `docs/340-pm-arc/*` | PM next-gen 3.4→4.0 — frozen with legacy 3.8.2 |
| `docs/roadmap/pm-nextgen-3.4-to-4.0.md` | Epic for the archive above |
| `docs/roadmap/post-3.0-product-bands.md` | Parking lot from 3.x era |
| `docs/roadmap/pm-mobile-workflows-and-complaints-2026.md` | Research that fed 3.x bands; useful context, not live stamp source |
| `docs/roadmap/band-3.2-posthog-patches.md` and siblings under `docs/roadmap/` (except live `docs/roadmap.md`) | Pre-v5 planning |
| `docs/specs/product-bands/*` | 3.x band specs |
| `docs/specs/*.md` (non–product-bands) | Legacy feature specs for frozen `src/` |
| `docs/architecture/*` | Early design notes |
| `docs/ARCHITECTURE.md`, `BEST-PRACTICES.md`, `ADDING-A-MODULE.md` | Describe the .NET modular monolith |
| `docs/ROLE-EXPERIENCE.md` | Title-first personas for legacy Explore-as-role |
| `docs/DEMO-COMPANY-PROFILES.md`, `mobile3.md`, `pitbull-digital-twin-spec.md`, `WORKFLOW-EVALUATION-MATRIX.md`, `ROADMAP-2.1.md` | Pre-v5 or out-of-5.0 spine |
| `docs/deployment/*` | Superseded by root `deploy/` |
| `docs/ci/pm-arc-deploy-safety.md` | Tied to 3.x PM arc stamps |
| Root `CHANGELOG.md` (3.8.x headers) | Legacy Keep a Changelog; v5 notes live in `v5/src/content/changelog.ts` |

## Partially refreshed / still needs follow-up

| Path | Gap |
|------|-----|
| `docs/roadmap-5.0.0.md` | Historical M2–M5 table stopped at an older SHA; superseded by `docs/roadmap.md` — do not treat status cells as current |
| `CONTRIBUTING.md` | Getting Started / validate steps still emphasize .NET + legacy web; light v5 lead-in added — deeper rewrite optional |
| `deploy/RAILWAY-SETUP.md`, `deploy/RAILWAY-DEMO.md` | Still show legacy Dockerfile paths in places; banner points at v5 — full rewrite follow-up |
| `docs/ROLE-EXPERIENCE.md` | Still documents six legacy personas; v5 has four role cards |
| `docs/ARCHITECTURE.md` | Still the living-looking monolith doc; treat as legacy until a v5 architecture page exists |
| Root `README.md` Documentation links | Still lists `CHANGELOG.md` / `ARCHITECTURE.md` without saying legacy — optional polish |
| `docs/security/*` | May mix legacy API assumptions with current Railway; verify before citing as live |

## Intentionally not rewritten in the truth pass

- Full body of `docs/architecture/*`, `docs/260712/*`, `docs/340-pm-arc/*` (banners only)
- Deep band-spec rewrites under `docs/specs/product-bands/`
- Product/runtime code (except VERSION alignment if already correct)

## Follow-up PR candidates

1. v5-oriented `docs/ARCHITECTURE.md` (or `docs/v5/architecture.md`) describing App Router + Drizzle + sandboxes  
2. Retarget or archive `docs/ROLE-EXPERIENCE.md` to the four v5 role cards  
3. Rewrite `CONTRIBUTING.md` Getting Started / validate around `v5/` only  
4. Rewrite `deploy/RAILWAY-SETUP.md` Dockerfile / service roots for the current `v5/` Railway config  
5. Mark or stub-redirect outdated links inside individual `docs/specs/*` bodies that still say “next free 3.8.1”
