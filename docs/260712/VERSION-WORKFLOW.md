# Pitbull version workflow (canonical)

**Effective:** 2026-07-12  
**Current product version:** see root [`VERSION`](../../VERSION)  
**Audience:** Grok Build, Composer, Claude Code, Codex, and any agent working this repo.

This document is the **single source of truth** for how we bump versions and ship. Do not re-derive rules in chat — read this file first.

---

## Program decision (locked)

**3.0.0 product scope = Arc A–E only** (mobile Phase 1–3, twin Phase 2, AI + approvals + office help + CI).

| Range | PRs (from 2.12.2) | Purpose |
|-------|-------------------|---------|
| **2.12.2 → 2.22.2** | **~101** | Product workload — every PR ships spec'd Arc A–E scope |
| **2.22.3 → 2.24.2** | **20** | **Release checklist runway** — verification + fixes only |
| **2.24.2 → 3.0.0** | **1** | Major stamp after checklist complete |

**Grand total ≈ 122 PRs** from first goal `2.12.2` to `3.0.0`.

**Hard stops:**

```text
Product features end at 2.22.2.
No new features after 2.22.2 (runway = fixes/verification only).
Major bump for this program: 2.24.2 → 3.0.0 ONLY.
Do not use 2.97.9 / 2.98.x / 2.99.x for 3.0.0.
Post-3.0 product bands (old G themes) live under docs/specs/product-bands/ and docs/roadmap/ — they do not block 3.0.0.
```

---

## Rule 1 — One version bump per clean PR

Every merge to `main` that is user-visible increments **exactly one** version step:

```
MAJOR.MINOR.PATCH  →  increment PATCH by 1
```

When `PATCH` reaches `9`, the next bump rolls **minor** and resets patch to `0`:

```
2.12.9  →  2.13.0
2.13.9  →  2.14.0
…
2.23.9  →  2.24.0
2.24.2  →  3.0.0    ← major bump ONLY here for this program
```

**Never skip a number.** Never ship two logical releases in one PR. Never merge without updating all version stamps (see Rule 3).

---

## Rule 2 — “Ten bumps to advance the middle digit”

To move from `2.12.x` to `2.13.x` you ship **ten** consecutive single-step PRs:

| Step | After PR merges | Notes |
|------|-----------------|-------|
| 1 | 2.12.2 | from 2.12.1 — agent infra |
| 2 | 2.12.3 | |
| 3 | 2.12.4 | |
| 4 | 2.12.5 | |
| 5 | 2.12.6 | |
| 6 | 2.12.7 | |
| 7 | 2.12.8 | |
| 8 | 2.12.9 | last patch in minor 12 |
| 9 | 2.13.0 | minor rolls |
| 10 | 2.13.1 | |
| 11 | 2.13.2 | Arc A checkpoint |

**Pattern (every minor band through 2.24.x):**

```text
2.N.2 → 2.N.3 → … → 2.N.9 → 2.(N+1).0 → 2.(N+1).1 → 2.(N+1).2
```

**Product arcs** (plan1.md) are checkpoints **inside** this line — they do not shorten the version ladder.

---

## Rule 3 — Version stamp checklist (every bump)

Per [`CONTRIBUTING.md`](../../CONTRIBUTING.md):

1. Root [`VERSION`](../../VERSION)
2. [`src/Pitbull.Web/pitbull-web/package.json`](../../src/Pitbull.Web/pitbull-web/package.json) + lockfile if version field present
3. [`src/Pitbull.Api/Pitbull.Api.csproj`](../../src/Pitbull.Api/Pitbull.Api.csproj) — `Version`, `AssemblyVersion`, `FileVersion`, `InformationalVersion`
4. Docker `ARG` defaults + `docker-compose.prod.yml` if applicable
5. [`CHANGELOG.md`](../../CHANGELOG.md) — new `## [x.y.z] - ISO-8601-with-offset` header; move items out of `[Unreleased]`
6. In-app version fallback if hardcoded (search `app-version`)

Run before push:

```powershell
./scripts/preflight.ps1 -FullWeb -DotNet
```

---

## Rule 4 — Spec before feature code

| Change type | Spec required |
|-------------|---------------|
| New user-facing feature | `docs/specs/<feature>.md` **before** implementation |
| Bugfix / hardening | Reference existing spec section or add ≤1 page addendum |
| Docs-only / agent infra | `docs/260712/` or `docs/specs/README.md` update |
| Release runway 2.22.3+ | No new product specs — checklist only |

Template + agent-ready bar: [`docs/specs/README.md`](../specs/README.md).

---

## Rule 5 — Help center for user-visible flows

Any ship that changes how a persona works must update [`help/page.tsx`](../../src/Pitbull.Web/pitbull-web/src/app/(dashboard)/help/page.tsx) in the **same PR** (workflow card + FAQ entry).

---

## Rule 6 — Development loop (agent + human)

```text
Read VERSION-WORKFLOW + plan1.md + goal prompt for target version
  → spec (if needed)
  → feat/fix branch from main
  → implement minimal diff
  → tests (unit + targeted E2E)
  → preflight.ps1
  → version bump ONE step
  → single clean PR → CI green → merge
  → next /goal prompt for next version
```

**Mobile platform (locked through 3.0.0):** PWA-first. No native iOS/Android app until post-3.0.0 decision gates in [`plan1.md`](./plan1.md). Performance = API shape + pagination + virtualization, not a native rewrite.

---

## Rule 7 — Truth over polish

From [`AGENTS.md`](../../AGENTS.md):

- Label metric proxies honestly; never invent executive KPIs.
- Twin overlays: never default-green; insufficient data stays neutral.
- Mobile: capture + glance + filtered drill — **no full ledger crunch on phone**.

---

## Roadmap anchor versions

| Checkpoint | Meaning |
|------------|---------|
| **2.13.2** | Arc A — mobile Phase 1 hardening |
| **2.14.2** | Arc B — plans field mode |
| **2.15.2** | Arc C — site walk & schedule |
| **2.19.2** | Arc D — twin Phase 2 |
| **2.22.2** | Arc E complete — **last product PR** |
| **2.22.3** | Runway opens — release checklist |
| **2.24.2** | Release candidate — all checklist boxes checked |
| **3.0.0** | Major — checklist complete after `2.24.2` |

---

## Where to look

| File | Purpose |
|------|---------|
| [`docs/260712/plan1.md`](./plan1.md) | Master plan, arcs, performance, 3.0.0 DoD |
| [`docs/260712/goal-prompts.md`](./goal-prompts.md) | Copy-paste `/goal` prompts per version |
| [`docs/260712/spec-workload.md`](./spec-workload.md) | Spec index Arc A–E + runway |
| [`docs/260712/release-checklist-runway.md`](./release-checklist-runway.md) | 2.22.3→3.0.0 runway |
| [`docs/mobile3.md`](../mobile3.md) | Field mobile product vision |
| [`docs/pitbull-digital-twin-spec.md`](../pitbull-digital-twin-spec.md) | Twin implementable spec |
| [`CHANGELOG.md`](../../CHANGELOG.md) | What actually shipped |
| [`docs/roadmap/post-3.0-product-bands.md`](../roadmap/post-3.0-product-bands.md) | Themes after 3.0.0 (not required for major) |
