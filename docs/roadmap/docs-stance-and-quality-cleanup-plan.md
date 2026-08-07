# Plan: Docs stance, code quality residual, Dependabot, Next.js 16.3

**Status:** Plan / documentation only (no product feature stamps in this doc)  
**Baseline product version:** `3.7.7` (root `VERSION`, 2026-08-06 inventory)  
**Owner intent:** Plan thoroughly; ship via separate PRs. Prefer truth over polish.  
**Related workflow:** [`.grok/workflows/docs-stance-improve.rhai`](../../.grok/workflows/docs-stance-improve.rhai) (2-agent iterative docs loop)

---

## 0. Why this exists

We ship stamps faster than hub docs update. **Round-1:** epic, product-bands README, band-3.8 remap, goal-prompts banner, and satellite pointers (`specs/README`, `pm-3.8-cpm-notes`, `340-pm-arc/README`) now track product **`3.7.7`** / next free **`3.7.8`**. Re-run the docs-stance workflow when `VERSION` moves so hubs do not lag again. Separately, hourly hardening left a large findings backlog, open Dependabot majors stall, and **Next.js 16.3** (2026-08-03) is available while the app is on **`next@^16.2.11`**.

This document is the **single planning surface** for:

1. Docs stance hygiene (agent-facing truth)  
2. Code quality / security residual from hardening reports  
3. Dependabot PR triage + upgrade waves  
4. Next.js 16.3 upgrade path (safe first, opt-in features later)

It does **not** authorize inventing PM features or reopening the completed 3.0 program (`docs/260712/`).

---

## 1. Truth hierarchy (standing rule)

| Priority | Source | Use for |
|----------|--------|---------|
| 1 | Root `VERSION` | “What version is the app?” |
| 2 | `CHANGELOG.md` published headers | What shipped and when |
| 3 | `src/`, tests | Behavior |
| 4 | Band specs under `docs/specs/product-bands/` | Band intent (headers may lag or lead) |
| 5 | Epic `docs/roadmap/pm-nextgen-3.4-to-4.0.md`, band README | **Often stale** — reconcile after stamps |
| 6 | `docs/architecture/*`, parking lots | Historical only |

**Agent rule:** Before a `/goal`, re-read `VERSION` + newest CHANGELOG headers. Do not trust “Next unshipped: 3.4.6” without checking.

**Cheap hygiene on every VERSION PR:** one-line update to epic status + product-bands README “next free stamp” (or run `docs-stance-improve` workflow).

---

## 2. Docs stance workstream

### 2.1 Workflow (2 subagents)

| Role | Mode | Job |
|------|------|-----|
| **Auditor** | read-only | Diff hub docs vs VERSION/CHANGELOG; emit priority_fixes (≤6) |
| **Writer** | read-write | Apply only those fixes; no product code; no VERSION bump by default |

Script: `.grok/workflows/docs-stance-improve.rhai`  
Report target: `docs/ci/docs-stance-improve-report.md`

```text
/workflow docs-stance-improve
# optional args:
# { "max_rounds": 3, "focus": "epic + band README + band 3.8 remap" }
```

### 2.2 High-leverage doc fixes (do these first)

**Round-1 hub fixes landed** (epic, product-bands README, band-3.8 remap, goal-prompts banner): those no longer claim Pending / next **3.4.6**. Keep this table as a **meta checklist** for residual satellite docs — not as proof hubs are still stale.

| File | Current problem | Target honesty |
|------|-----------------|----------------|
| `docs/roadmap/pm-nextgen-3.4-to-4.0.md` | ~~Status Pending / next 3.4.6~~ → **fixed** (In progress; 3.7.7 → 3.7.8) | Maintain: bands 3.5–3.7 shipped; next free after `VERSION` |
| `docs/specs/product-bands/README.md` | ~~Pending/stub 3.5–3.8~~ → **fixed** | Maintain: 3.5–3.7 Shipped; 3.8 partial; next free stamp |
| `docs/specs/product-bands/band-3.8-pm-cpm-practices.md` | ~~3.7.6–3.8.0 as remaining~~ → **fixed** (remap 3.7.8–3.8.0) | Maintain: never reclaim diverted 3.7.6/3.7.7 |
| `docs/340-pm-arc/goal-prompts.md` | ~~Opens at 3.4.x only~~ → **fixed** (live banner + 3.7.8 goals) | Maintain live section at top |
| `docs/specs/README.md` | ~~first band / next 3.4.1~~ → **fixed** (active band-3.8; next free 3.7.8) | Maintain with VERSION |
| `docs/ci/pm-3.8-cpm-notes.md` | ~~3.7.6+ remaining~~ → **fixed** (diverted 3.7.6/3.7.7; free 3.7.8–3.8.0) | Maintain remap |
| `docs/340-pm-arc/README.md` | ~~Status Pending / First band only~~ → **fixed** (In progress; Active band 3.8) | Maintain next free after VERSION |
| `AGENTS.md` / `Claude.md` | Live arc links OK; avoid wrong “next stamp” if any | Align with VERSION if they cite a number |

**Round-3 residual (closed — docs-stance writer):** focus hubs (epic, product-bands README, band-3.8 remap, goal-prompts banner) remain **maintain-with-VERSION**. High-leverage leftovers closed: **AGENTS task-routing** (Any version ship → `340-pm-arc`, not `260712`) + **band-3.5 DoD/CI notes** lag + specs README **2.12.2** template stamp. Not a product feature stamp.

**Do not rewrite:** `docs/260712/*` (historical), frozen `docs/architecture/*` design notes, past CHANGELOG entries.

### 2.3 Docs PR shape

- **No VERSION stamp** required for docs-only honesty (chore).  
- Optional: mention in Unreleased “Docs: PM arc status aligned to 3.7.7”.  
- Preflight not required for pure markdown; still run if touching agent-facing status that gates CI docs tests.

### 2.4 Acceptance for docs stance

- [x] Epic status matches reality (in progress; 3.5–3.7 done) — closed by `docs-stance-improve` 2026-08-06  
- [x] “Next free stamp” = after current `VERSION` (`3.7.8`)  
- [x] Band 3.8 does not assign work to already-published versions (`3.7.6`/`3.7.7` Diverted; free `3.7.8`–`3.8.0`)  
- [x] product-bands README status table matches band file headers  
- [x] Report written under `docs/ci/docs-stance-improve-report.md` after a workflow run  

---

## 3. Code quality residual workstream

Source of truth for findings: `docs/ci/app-hardening-loop-report.md` (large backlog; many items already fixed in later hourly rounds — **re-verify before fixing**).

### 3.1 Triage rules

1. Re-open the cited file; if the issue is already fixed, mark **closed** in a short residual list (do not re-fix).  
2. Prefer **auth / demo safety / multi-tenant / LogSafe** over pure style.  
3. One concern family per PR when possible (e.g. JWT claim parity, then LogSafe leftovers).  
4. No MediatR in controllers; no gstack; demo restrictions stay.  
5. Add unit tests when behavior changes.

### 3.2 Priority buckets (re-verify each row)

| Bucket | Theme | Examples from hardening inventory (verify live) | Suggested PR theme |
|--------|--------|--------------------------------------------------|--------------------|
| **P0** | AuthZ / demo escape | Company-switch JWT missing `is_demo_user`; demo-register passwordless path; Inactive user still login; demo `permissions=*` breadth | `security(auth): …` |
| **P0** | Tenant / company isolation | Company middleware Empty = all companies; empty UCA allow-all; X-Tenant-Id over JWT | `security(tenancy): …` |
| **P1** | LogSafe / CodeQL | Residual untrusted strings in logs / diagnostics persistence | `security(logging): …` |
| **P1** | Diagnostics abuse | Anonymous diagnostics mass-assignment / length caps | `security(diagnostics): …` |
| **P2** | Input bounds | AI length caps, widget/tour bounds (partially on hardening branch) | Continue `chore/app-hardening-hourly-*` |
| **P2** | SQL style | Parameterized `SqlQueryRaw` (partially fixed) | Close if green |
| **P3** | Deps hygiene | Hangfire pin exact, CAP package set aligned, image digests | Fold into Dependabot waves |

### 3.3 Local branch already in flight

Branch `chore/app-hardening-hourly-2026080121` (uncommitted at plan time) includes:

- Welcome tour step id / count caps  
- Dashboard widget save validation  
- Cost prediction list `.Take(100)`  
- **In-app changelog progressive load** (offset/`totalCount`, About page infinite scroll)

**Ship plan:** finish tests → single chore PR (no VERSION unless you choose a residual stamp) → then start docs stance PR or quality P0s on a clean branch from `main`.

### 3.4 Acceptance for quality cleanup

- [ ] Each merged fix references a verified finding (file + evidence)  
- [ ] Unit tests for auth/tenancy behavior changes  
- [ ] `./scripts/preflight.ps1 -FullWeb -DotNet` on security-touching PRs  
- [ ] Hardening report residual section updated (or new short residual note) when a bucket is cleared  

---

## 4. Dependabot / upgrade workstream

Inventory date: **2026-08-06**. Config: `.github/dependabot.yml` (weekly; nuget + npm web + npm e2e + docker + GHA).

### 4.1 Open Dependabot PRs (triage)

| PR | Change | Class | Recommendation |
|----|--------|-------|----------------|
| [#507](https://github.com/jgarrison929/pitbull/pull/507) | CAP + Dashboard | NuGet minor/set | **Coordinate CAP set** — do not merge one CAP PR alone. CI (2026-08-06): **.NET Build & Test FAIL** |
| [#508](https://github.com/jgarrison929/pitbull/pull/508) | CAP + PostgreSql | NuGet set | Same; CI: **.NET Build & Test FAIL** |
| [#509](https://github.com/jgarrison929/pitbull/pull/509) | CAP + RedisStreams | NuGet set | Same; CI: **.NET Build & Test FAIL**. Align full CAP set in one human PR |
| [#434](https://github.com/jgarrison929/pitbull/pull/434) | TypeScript 6→7 | Major | CI: **Frontend FAIL** — pair with Next 16.3, not blind merge |
| [#463](https://github.com/jgarrison929/pitbull/pull/463) | node Docker **22→25** alpine | Major runtime | **Hold** — stay on Node 22 LTS line for production images until explicit decision |
| [#447](https://github.com/jgarrison929/pitbull/pull/447) | Resend 0.2.1→0.8.0 | Major | **Hold** — API churn; dedicated PR + email send tests |
| [#446](https://github.com/jgarrison929/pitbull/pull/446) | QuestPDF 2026.2→2026.7 | Major | **Hold** — PDF golden/smoke first |
| [#443](https://github.com/jgarrison929/pitbull/pull/443) | Mapster 7→10 | Major | **Hold** — mapping compile surface; needs full solution build |
| [#438](https://github.com/jgarrison929/pitbull/pull/438) | eslint 9→10 | Major tooling | **Hold** — FE build historically red; flat-config migration |
| [#436](https://github.com/jgarrison929/pitbull/pull/436) | @types/node 25→26 | Types major | **Hold** until Node runtime decision |
| [#431](https://github.com/jgarrison929/pitbull/pull/431) | jest-dom 6→7 | Major test | **Hold** — vitest compatibility pass |

Also known policy: **Microsoft.OpenApi ≥3** ignored in dependabot.yml (ASP.NET Core 10 generator break). Do not fight that ignore until upstream supports 3.x.

### 4.2 Upgrade waves (ordered)

| Wave | Scope | Gate |
|------|--------|------|
| **W0** | Close/supersede conflicting CAP Dependabot PRs; ship **one** aligned CAP package set from `main` | `dotnet restore` zero NU1605; unit + integration green |
| **W1** | Safe NuGet patch/minors only (non-major, non-OpenApi-3) | Same as W0 |
| **W2** | **Next.js 16.3** (+ peer react if required) — see §5 | `npm ci`, lint, `next build`, smoke e2e subset |
| **W3** | TypeScript 7 **only if** W2 green and Next docs path is clear | `next build` typecheck; vitest |
| **W4** | eslint 10 | Dedicated lint migration PR |
| **W5** | Mapster 10 / QuestPDF / Resend | One major per PR; product smoke for email/PDF/mapping |
| **W6** | Node 25 Docker / @types/node 26 | Explicit runtime decision; prefer LTS |

### 4.3 Acceptance for deps

- [ ] No half-upgraded CAP set on `main`  
- [ ] Docker Node major not merged without decision record in this doc or CHANGELOG  
- [ ] Majors that fail CI stay open or closed with comment linking this plan  
- [ ] After merges: update Unreleased or stamp per CONTRIBUTING if versioned release  

---

## 5. Next.js 16.3 upgrade plan

**Upstream:** [Next.js 16.3](https://nextjs.org/blog/next-16-3) (stable 2026-08-03).  
**Current app:** `src/Pitbull.Web/pitbull-web` → `"next": "^16.2.11"`, React 19.2.x, product version 3.7.7.

### 5.1 Goals

| Goal | In scope for first PR? |
|------|-------------------------|
| Dev memory + default Turbopack improvements | **Yes** (default benefits) |
| Faster builds / SSR (no app code change) | **Yes** |
| Instant Navigations (`cacheComponents`, `partialPrefetching`) | **No** — follow-up |
| Experimental React Compiler / useOffline | **No** — later |
| TypeScript 7 via Next typecheck path | **Optional follow-up** (pairs with Dependabot #434) |

### 5.2 First PR (recommended)

1. Branch from latest `main` (after W0 CAP if needed).  
2. In `pitbull-web`: `npm install next@latest` (pin exact 16.3.x in package.json after resolve).  
3. Align `eslint-config-next` if it tracks Next major/minor.  
4. Run: `npm run lint`, `npx next build`, unit vitest, targeted Playwright smoke if available.  
5. Check Railway/Docker web image still builds (`node:22-alpine` stay).  
6. Document in CHANGELOG Unreleased: “Web: Next.js 16.2 → 16.3 (default perf; Instant Navigations not enabled).”  
7. VERSION stamp: only if you treat this as a product residual stamp; otherwise chore is fine — **prefer one stamp if you are mid-band**, else chore.

### 5.3 Explicit non-goals for first 16.3 PR

- Enabling `cacheComponents: true` / `partialPrefetching: true` without a dedicated mobile/PWA navigation review  
- Migrating to Cache Components for the whole dashboard  
- Node 25 base image  
- Claiming Instant Navigation for field PWA without e2e `instant()` tests  

### 5.4 Follow-up spikes (document outcomes)

| Spike | Outcome to record |
|-------|-------------------|
| Instant Insights on PM/field routes | Which routes block; loading.tsx gaps |
| Partial prefetch on bottom-nav targets | Prefetch cost vs battery |
| `@next/playwright` `instant()` | One smoke test for home → RFI list if adopted |
| TS 7 + `useTypeScriptCli` | Build time delta; break list |

### 5.5 Acceptance for Next 16.3

- [ ] `next` resolved ≥ 16.3.0  
- [ ] Production build green locally + CI  
- [ ] No accidental enable of experimental Instant Navigation flags  
- [ ] Demo/app health checks after deploy (`docs/ci/pm-arc-deploy-safety.md`)  

---

## 6. Suggested PR / branch sequence

```text
A. chore: ship open hardening branch (bounds + changelog progressive load)
B. docs: docs stance hub honesty (or run docs-stance-improve workflow → PR)
C. security: P0 auth/tenancy residuals (re-verified)
D. deps: CAP set alignment (supersede #507–#509)
E. deps(web): Next.js 16.3 first PR
F. security/quality: P1 LogSafe + diagnostics
G. deps: TS7 / eslint10 / majors one-at-a-time
H. product: resume PM band 3.8 remapped stamps (after docs remap)
```

Parallelism: **A/B** can parallel on different branches; **E** after **A** if web lockfile conflicts; **H** only after **B** so agents stop targeting 3.4.6.

---

## 7. Workflows inventory

| Workflow | Path | Use |
|----------|------|-----|
| Docs stance (2 agents) | `.grok/workflows/docs-stance-improve.rhai` | Iterative hub doc honesty |
| App hardening loop | `.grok/workflows/app-hardening-loop.rhai` | Security/quality discovery→fix |
| Financial math review | `.grok/workflows/financial-math-review.rhai` | WIP/math arc |

---

## 8. Out of scope (this plan)

- Reordering the PM version spine in chat without updating the epic  
- Invented executive KPIs or green-default twin state  
- Native app shell  
- Merging red Dependabot majors “to clear the queue”  
- Full rewrite of historical docs under `docs/260712/` or `docs/architecture/`  

---

## 9. Revision log

| Date | Note |
|------|------|
| 2026-08-06 | Initial plan: docs stance + quality residual + Dependabot inventory + Next 16.3 path; product baseline 3.7.7 |
| 2026-08-06 | **Docs stance wave closed** via workflow `docs-stance-improve` (3 rounds): hubs + band 3.8 remap + report; §2.4 checked. Next free stamp **3.7.8**. |

When a wave completes, append a short row here (or close the wave checkboxes in a follow-up PR). Do not leave “next unshipped 3.4.6” anywhere agent-facing after the docs stance PR.
