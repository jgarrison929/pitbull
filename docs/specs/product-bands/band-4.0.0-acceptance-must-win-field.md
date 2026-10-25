# Spec: Product band 4.0.0 - Acceptance (must-win field workflows)

**Status:** Pending (acceptance contract for major **`4.0.0`**; OBJECTIVE remediation lands on free **3.x** stamps before major)  
**Version band:** Pre-4.0.0 remediation on free stamps after product **`3.8.0`** (next free **`3.8.1`**) through runway **`3.12.9`**, then major **`4.0.0`**  
**Theme:** Single-platform job costing + PM mobile-first - honest field/PM phone bar for major  
**Epic:** [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
**Runway stub:** [`band-3.12-runway-and-4.0.0.md`](./band-3.12-runway-and-4.0.0.md)  
**Program:** [`docs/340-pm-arc/`](../../340-pm-arc/)  
**Mobile principles:** [`docs/mobile3.md`](../../mobile3.md) | [`AGENTS.md`](../../../AGENTS.md)  
**CI notes (at major):** [`docs/ci/pm-4.0.0-acceptance-notes.md`](../../ci/pm-4.0.0-acceptance-notes.md)  
**Owner:** Spec-Writer | architecture NACK: Solutions-Lead | implement: Api-Engineer + Web-Engineer | e2e gate: Qa-Gate  

> **Keep/Cut is locked by the core room.** Spec-Writer documents and tests the bar; do not reopen scope in chat.

---

## Problem

Pitbull already has job-cost APIs and a project Job Cost page, but the phone/PM field path is not a trustworthy single-platform cost glance:

1. `projects/[id]/job-cost/page.tsx` loads budgets, actuals, and cost codes with **`pageSize=500`**, then **client-joins** by `costCodeId` into variance rows.  
2. `PaginationQuery` clamps `PageSize` to **max 100**, so `pageSize=500` is already dishonest on larger jobs (silent truncation + broken client rollups).  
3. Job Cost sits under project **More** for field chrome, not a primary PM/field tab path.  
4. Market bar for 4.0.0 is **single-platform job costing + PM mobile-first** - not desktop-shrunk ERP, not AI/Digital Twin theater, not payroll-as-sell-gate.

Without a server `?view=mobile` job-cost contract and phone glance, 4.0.0 would stamp a major without the must-win field workflow.

---

## Personas

Persona resolution is **title / `role_profile` first** (not Identity role alone). E2E: [`e2e/fixtures/ROLE-PERSONA-MAP.md`](../../../e2e/fixtures/ROLE-PERSONA-MAP.md).

| Persona | Profile / demo | 4.0.0 job-cost role |
|---------|----------------|--------------------|
| Project Manager | `pm` / `pm@demo.local` | **Primary:** Job Cost on bottom tabs - glance + filtered drill by cost code |
| Superintendent / field | `field` / `superintendent` Explore-as-role; `field-eng@demo.local` | **Primary:** same tab path; **read-mostly** glance unless permission says otherwise |
| Controller / CFO | `cfo` | Optional deep-link glance only - **not** a phone ledger |
| Estimator | `estimator` | **Not** a primary job-cost tab owner for 4.0 must-win |
| Contract Administrator | `contractadmin` | **Not** a primary job-cost tab owner; Keep SoT = contracts/SOV/COs + pay-app glance |
| Admin | Admin | RLS + permissions hold; demo safety (`IsDemoUser` + DemoRestrictionMiddleware) - no admin mutations that break demo |

### RLS / Qa-Gate hooks

- Tenant RLS: field/PM only see job-cost for projects their company (and permissions) allow - same as other project-scoped PM APIs.
- Gate e2e on `role_profile` / title personas above, not `Manager` Identity alone.
- Demo restrictions unchanged.

---

## Keep / Cut lock (core room)

### Keep (source of truth - must remain true at 4.0.0)

| Area | Bar |
|------|-----|
| **Projects / cost codes** | Projects module + `api/cost-codes` remain SoT for codes; project-scoped job cost references real codes |
| **Contracts / SOV / COs** | Contracts module SoT; mobile list/detail/glance per bands **3.6** (shipped) - no fork |
| **Billing pay apps glance** | Billing SoT; phone = status glance + deep link (band **3.11** when shipped, or explicit deferred note) |
| **RFIs / Submittals** | Shipped mobile foundation band **3.5**; maintain `?view=mobile` slim contracts |
| **Schedule / CPM server truth** | Gantt glance + Kanban band **3.7** shipped; CPM honesty band **3.8** (finish remapped **`3.8.1`**); **no** desktop-parity Gantt **edit** on phone |
| **TimeTracking** | Existing mobile capture paths remain; labor feeds actuals via real pipelines - do not invent phone payroll |
| **RLS** | Tenant/company RLS stays enforced on job-cost and adjacent reads/writes |
| **PWA capture / glance / drill** | Phone = capture + glance + filtered drill; offline only what queue/cache actually holds |

### Cut (explicit non-goals through 4.0.0)

| Cut | Why |
|-----|-----|
| Desktop-parity Gantt **edit** on phone | Glance/Kanban only; edit stays desktop |
| Phone **portfolio / ledger** rollups | No client multi-project cost aggregation |
| **Invented KPIs** / fake project-health composites | Truth over polish |
| **Digital Twin / AI theater** as sell gates | Capture quality may continue; twin/AI not acceptance for major |
| **Payroll** as sell gate after core | Payroll module exists; not a 4.0.0 field must-win |
| Native iOS/Android shell | PWA-first |
| Client `pageSize=500` join for job cost | Replaced by combined `GET .../job-cost/glance` |

---

## North star + named OBJECTIVE

**North star:** single-platform job costing + PM mobile-first.

**OBJECTIVE (must-win):** Mobile job costing via a **combined server glance** on PM and field tabs - **no client `pageSize=500` aggregation**.

**Implementer banner:** Api/Web must **not** implement dual-list as the 4.0 phone bar. Phone = `/job-cost/glance` only.

**Contract shape (Solutions-Lead NACK / lock):**

- **Canonical phone route:** `GET /api/projects/{projectId}/job-cost/glance` on existing `ProjectJobCostController` / `IJobCostService`.
- `?view=mobile` on that route is fine for consistency; if `glance` is mobile-only, document that and keep the same field contract.
- Do **not** invent `/api/mobile/*`.
- Do **not** use dual slim `budgets` + `actuals` lists as the **phone** path. Dual list endpoints may remain for **desktop edit** UIs only and must **never** be client-joined for phone totals.
- **Not phone OBJECTIVE:** do not ship dual `budgets?view=mobile` + `actuals?view=mobile` as the 4.0 phone bar. A `budgets?view=mobile` alias is allowed **only** if it returns the **identical glance DTO** (not budget-only); prefer explicit `/glance` so Api/Web do not implement dual-list phone.
- Phone must **not** call `GET /api/cost-codes?pageSize=500` (or any mega cost-code fetch) for the glance. `costCode` / `costCodeId` ride on each glance row. Separate slim cost-code picker later only if a capture flow needs it - **out of 4.0.0 must-win** unless this spec later says otherwise.
- Authz: pm + field read under existing **`Projects.View`** (job-cost manage claims for writes). **Do not weaken** RLS or permissions. Persona gate = `role_profile` pm + field/superintendent per ROLE-PERSONA-MAP - Identity role alone is insufficient.

**Ship-fail:** `PaginationQuery` max page size is **100**. If the phone path still hits `pageSize=500` budgets/actuals/cost-codes client join (today's `job-cost/page.tsx` anti-pattern), that is a **fail** - silent truncation + dishonest rollups.
## User journey (target - phone)

1. As PM or field persona, open an **active project** from PM/field chrome in few taps.  
2. Open **Job Cost** from a primary mobile tab / project hub entry (not only buried under More for these personas).  
3. See a **paginated** slim list from `GET .../job-cost/glance`: cost code, description (optional), budget, actual, variance - scannable at ~390px.  
4. Empty project = honest empty (“No budget lines”) - never “on budget / healthy” framing.  
5. Tap -> optional filtered drill (same glance filter by cost code) or desktop deep link - no full SOV/GL editor required on phone.  
6. Pull-to-refresh / reload uses `/job-cost/glance` only - **no** `pageSize=500` triple fetch (ship-fail if present).  
7. Never show cross-project portfolio cost totals on this surface.

---

## Primary code touchpoints

| Area | Paths |
|------|--------|
| API | `src/Pitbull.Api/Controllers/ProjectManagementControllers.cs` (`ProjectJobCostController`, route `api/projects/{projectId}/job-cost`), `CostCodesController.cs` |
| Domain / services | `src/Modules/Pitbull.ProjectManagement/` (`IJobCostService` / `ListBudgetsAsync` / `ListActualsAsync`), `Pitbull.Core` cost-code features, `PaginationQuery` (max page size 100) |
| Web | `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/projects/[id]/job-cost/page.tsx`, `components/layout/workspaces.ts` (pm + field `mobileTabs` / project workspace), optional `lib/*job-cost-mobile*` helpers |
| Help | `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/help/page.tsx` |
| Tests | API unit/mapper tests for mobile DTOs; vitest for empty honesty / URL builders; e2e notes for Qa-Gate |
| E2E map | `e2e/fixtures/ROLE-PERSONA-MAP.md` - gate **pm** + **field-eng** (and superintendent Explore-as-role when used) |

---

## API touchpoints

**Locked (Solutions-Lead + Chief CoS):** phone OBJECTIVE uses **combined glance** on the existing controller. Do **not** invent `/api/mobile/*`.

| Route | Role |
|-------|------|
| `GET /api/projects/{projectId}/job-cost/glance` | **Canonical phone path** - paged glance rows (budget/actual/variance per cost code); `IJobCostService`; optional `?view=mobile` for consistency |
| `budgets?view=mobile` glance-shaped alias | **Not** the phone bar. Allowed only if identical to glance DTO; prefer `/glance`. Dual budget+actual mobile lists = desktop-only |
| `GET .../job-cost/budgets`, `.../actuals` (existing) | **Desktop edit** UIs only - must **never** be client-joined for phone totals |
| `GET /api/cost-codes?pageSize=500` (or any mega fetch) | **Forbidden** on phone glance path - `costCode` / `costCodeId` ride on each glance row |
| Slim `cost-codes?view=mobile` picker | Out of 4.0.0 must-win unless a later capture flow needs it |
| Permissions | Read: existing **`Projects.View`**; writes: existing job-cost manage claims - **do not weaken** |
| RLS | Unchanged tenant/company filters - same as other project-scoped PM APIs |
| DI | Controllers stay `IJobCostService` inject - **no MediatR**; no forking entities out of ProjectManagement |

**UI-only rows** must still document which API they consume.

### Hard no-client-rollup boundaries

- Phone must **not** fetch `pageSize=500` budgets + actuals + cost-codes and join/aggregate in the browser (today's `projects/[id]/job-cost/page.tsx` anti-pattern).
- **Ship-fail:** `PaginationQuery` max page size is **100**. Phone still hitting `pageSize=500` client join = fail (silent truncation + dishonest rollups).
- Variance / budget-vs-actual / remaining = **server-computed fields on the glance DTO** - labeled honestly; **no** invented "job health %".
- No portfolio / multi-project cost rollup on phone.
- No GL / chart-of-accounts / journal mobile in 4.0.
- Job-cost SoT already exists (`IJobCostService`, `PmJobCostBudget` / Actual / Commitment / Forecast) - acceptance is **mobile shape + nav**, not greenfield costing.

### Mobile glance DTO field contract (ACK - Solutions-Lead)

**Scope:** binding contract for phone OBJECTIVE. Mirror RFI/CO honesty bar (no health/KPI fields).  
**Runtime:** not required until JC implementation stamps.

#### Allowed glance item fields

| Field | Required | Notes |
|-------|----------|--------|
| `id` | yes | Stable glance/budget line id |
| `costCodeId` | yes | FK to cost code |
| `costCode` | yes | Display code/number from SoT (on the row - no mega cost-code fetch) |
| `description` | optional | Short label |
| `budgetAmount` | yes | Server money; 0 if none |
| `actualAmount` | yes | Server money; 0 if none |
| `variance` | yes | **Server-computed** (`budgetAmount - actualAmount` or documented product sign) |
| `updatedAt` | optional | ISO when known |

#### Explicit exclusions

- Invented `% complete`, "health", "on track", portfolio totals, executive KPI tiles
- Heavy collections (full forecast series, commitment ledgers, AI cost-to-complete narratives)
- Client-side ledger / multi-project aggregation fields
- Payroll / burden breakdowns as acceptance fields
- Digital Twin spatial ids as required fields
- GL / chart-of-accounts / journal fields
- Dual slim budget-only + actual-only DTOs as the **phone** contract

#### Empty honesty

Empty list = honest empty. **Never** empty-as-healthy or "all codes on budget."
## Keep-SoT acceptance checklist (gate for major `4.0.0`)

Qa-Gate gates e2e / smoke on what this section names. Unshipped ladder bands stay **honest**: ship per epic **or** write an explicit deferred note with reason before major.

### Projects / cost codes

- [ ] Cost codes remain SoT via `api/cost-codes` / Core cost-code services  
- [ ] Job-cost mobile glance references real `costCodeId` values (no invented codes)  
- [ ] Phone does not call `cost-codes?pageSize=500` (or any mega cost-code fetch) for the glance  

### Contracts / SOV / COs

- [ ] Band **3.6** shipped mobile CO + subcontract surfaces still present (`?view=mobile` where introduced)  
- [ ] No dual-write of contract money into a new PM-only entity for 4.0.0  

### Billing pay apps glance

- [ ] Band **3.11** shipped **or** epic/band deferred note names pay-app phone glance as deferred with reason  
- [ ] When present: status glance + deep link only - no phone ledger rollup  

### RFIs / Submittals

- [ ] Band **3.5** slim mobile list/detail still the contract  
- [ ] No invented register-health KPIs on phone  

### Schedule / CPM server truth

- [ ] Band **3.7** Gantt glance + Kanban bar held  
- [ ] Band **3.8** remapped remainder shipped on **`3.8.1`** (recalc honesty + phone UI + help) **or** explicit deferral (not silent drop)  
- [ ] **Cut held:** no desktop-parity Gantt **edit** on phone  

### TimeTracking

- [ ] Field/PM can still capture time on existing mobile routes  
- [ ] Payroll module **not** required as sell gate for 4.0.0  

### RLS

- [ ] Job-cost and cost-code reads/writes remain tenant/company scoped under RLS  
- [ ] Demo restrictions unchanged (`IsDemoUser` + middleware)  

### PWA capture / glance / drill

- [ ] Phone job-cost path is glance + filtered drill (OBJECTIVE)  
- [ ] Offline claims only match real queue/cache behavior  
- [ ] **Cut held:** no phone portfolio/ledger rollups; no invented KPIs  

### OBJECTIVE - mobile job costing

- [ ] `GET .../job-cost/glance` shipped per glance DTO contract (canonical phone path; no `/api/mobile/*`)  
- [ ] PM + field can open Job Cost from mobile chrome without desktop-only traps  
- [ ] `job-cost/page.tsx` phone path uses `/glance` only - **ship-fail** if still `pageSize=500` client join  
- [ ] Unit/mapper tests + documented Qa-Gate persona smoke (pm + field-eng)  

---

## People-visible sellability gates (Product-GTM)

Demo / collateral must prove these with **ROLE-PERSONA-MAP** personas only (`pm@demo.local`, `field-eng@demo.local`, `ceo@demo.local`, CFO via Explore/`role_profile`). Qa-Gate can assert; API RLS enforces. Claim map: Product-GTM `gc-tool-replacement-4.0.0.md` (keep aligned to this band's SA lock: combined `/job-cost/glance`).

### Gate 1 - PM phone loop (~390px)

Persona: **`pm@demo.local`** (`role_profile` pm).

- [ ] On ~390px: open **RFI or CO** status (Keep: bands **3.5** / **3.6** slim mobile - not desktop-shrunk tables)
- [ ] On ~390px: **schedule glance** (Keep: band **3.7**; CPM honesty per **3.8** / `3.8.1` - **not** Gantt edit)
- [ ] Deep link into **job cost** glance (`GET .../job-cost/glance`) and, when Keep allows, **billing/pay-app** status glance - without portfolio ledger UI

### Gate 2 - Server-built job cost / WIP honesty

Persona: **`pm@demo.local`** and/or **`ceo@demo.local`** / CFO (`role_profile` controller) for an **active** demo job.

- [ ] Job-cost phone path shows **server** budget / actual / variance per cost code via combined **`/job-cost/glance`** (OBJECTIVE) - no client aggregation
- [ ] Any WIP / cost-to-complete / % complete shown in the demo path comes from **real server aggregations** or is an **explicitly labeled proxy** per [`docs/roadmap/financial-math-wip-arc.md`](../../roadmap/financial-math-wip-arc.md) + [`docs/ROLE-EXPERIENCE.md`](../../ROLE-EXPERIENCE.md)
- [ ] **No silent fake % complete** (seed scale lies, empty-as-healthy, or invented job-health %)
- [ ] If AP-inclusive cost-to-date (or other WIP source honesty) is required to stop lying and SA blocks it, **escalate to Chief** (architecture vs sellability) - do not paper over with client math

### Gate 3 - Must-NOT-claim (sell fail)

- [ ] No client **portfolio** / multi-project cost rollup on phone
- [ ] No invented **health** / retention **scores**
- [ ] No **AI theater** as a sell gate
- [ ] No **certified-payroll** / payroll-product claim as a 4.0 sell gate

### Packaging lead (non-binding to implementers)

Lead story: mid-market GC on **job cost on the same platform as PM/field paper** + Keep mobile loop (RFI/CO/schedule glance). Demo sequence: PM/field Job Cost glance -> PM RFI/CO/schedule phone loop -> CA pay-app/compliance when shipped.
## OBJECTIVE remediation stamp plan (logical JC rows)

**Placement rule (truth):**  
Product is **`3.8.0`**; next free stamp is **`3.8.1`** (band 3.8 CPM remapped remainder - **do not divert again for job cost**). Intervening bands **3.9-3.11** stay on their themes. Schedule OBJECTIVE implementation on **band 3.12 hub polish** free stamps (and only use runway **`3.12.1`-`3.12.9`** for deploy/CI/copy honesty - **not** for dumping JC features). Exact VERSION numbers are assigned when 3.12 opens (Release-Ops / VERSION-WORKFLOW); until then track **JC-*** rows below.

| Logical | Deliverable | Files (primary) | Acceptance | Tests |
|---------|-------------|-----------------|------------|-------|
| **JC-1** | Open OBJECTIVE: publish mobile job-cost DTO contract + empty honesty in this spec; CI notes stub | this file; `docs/ci/pm-4.0.0-acceptance-notes.md` | - [ ] Contract fields + exclusions frozen<br>- [ ] No runtime required | docs review |
| **JC-2** | Combined `GET .../job-cost/glance` (glance DTO; server variance); `IJobCostService` | `ProjectJobCostController`, JobCost service, glance DTO/mapper | - [ ] Canonical `/glance` (no `/api/mobile/*`)<br>- [ ] Paginated<br>- [ ] Authz/RLS unchanged (`Projects.View`)<br>- [ ] budget/actual/variance server-computed | unit: mapper empty/one/forbidden |
| **JC-3** | Cost-code labels on each glance row (no mega cost-code fetch) | glance mapper joins SoT labels server-side | - [ ] Phone does not call `cost-codes?pageSize=500`<br>- [ ] `costCode`/`costCodeId` on row | unit + API |
| **JC-4** | Phone-first Job Cost UI uses `/job-cost/glance`; remove client join aggregation | `projects/[id]/job-cost/page.tsx`, `lib/*job-cost-mobile*` | - [ ] Usable ~390px<br>- [ ] Loading/empty/error honesty<br>- [ ] Ship-fail if phone still `pageSize=500` join | vitest URL/empty helpers |
| **JC-5** | Surface Job Cost on **PM + field** mobile tabs / project hub (primary path) | `workspaces.ts` / mobile nav | - [ ] Few taps from pm + field chrome<br>- [ ] Permission-gated | vitest nav config |
| **JC-6** | Help Center + Qa-Gate persona notes | `help/page.tsx`; e2e notes / ROLE-PERSONA-MAP reference | - [ ] Routes real<br>- [ ] pm + field-eng named for gate | vitest help helper; e2e doc |
| **JC-7** | Buffer: residual honesty + tests only | tests | - [ ] No new feature scope | unit/vitest green |
| **4.0.0** | **Major checkpoint** | CHANGELOG; epic status; this spec -> Shipped; CI notes filled | - [ ] Keep-SoT checklist complete or explicit deferred notes<br>- [ ] OBJECTIVE Done<br>- [ ] Cut list still cut<br>- [ ] Preflight green | Qa-Gate + preflight |

### Out-of-scope for OBJECTIVE stamps

- `/api/mobile/*` - escalate to Chief if proposed. `/job-cost/glance` on `ProjectJobCostController` is the **required** phone path. Dual slim budgets+actuals as phone path - escalate.
- Cost-to-complete AI cards / `CostToCompleteCard` as acceptance gate (labeled proxy only if already real; not a sell gate)  
- Forecast / commitment full ledgers on phone  
- Editing full budget books on phone (light confirm edit optional later - not required for 4.0.0)  
- Reordering 3.9-3.11 themes to insert JC early without Release-Ops agreement  

---

## Already-true facts (do not contradict in acceptance)

- Job-cost SoT already exists (`IJobCostService`, `PmJobCostBudget` / Actual / Commitment / Forecast) - bar is **mobile shape + nav**, not greenfield costing.
- `?view=mobile` already ships for RFI / submittal / CO / subcontract / activities / projects - job-cost must match that honesty bar (no health/KPI fields on mobile DTOs).
- Native app / Capacitor / full Gantt edit / Digital Twin / payroll sell-gate are out - not must-win.
- Do not require relocating Billing entities into PM.
- Epic must name job-costing as a 4.0 must-win OBJECTIVE (patch alongside this band).

## Non-goals

- Reopening Keep/Cut  
- ERPNext/Odoo-style rewrite of costing  
- MediatR in controllers  
- Relocating Billing/Contracts entities into PM without a later explicit decision  
- Claiming bands 3.9-3.12 shipped before they are  

---

## Truth rules

1. No invented executive KPIs or “job cost health” composites on phone.  
2. Money and counts come from real entities or **labeled** proxies (`docs/ROLE-EXPERIENCE.md`).  
3. Empty states are honest empty.  
4. Offline: only claim what the queue/cache holds.  
5. Phone = capture + glance + filtered drill - **no client portfolio/ledger rollup**.  
6. Demo restrictions stay.  
7. Controllers inject `I*Service` - **no MediatR in controllers**.

---

## Test plan

| Layer | What |
|-------|------|
| Unit (API) | Mobile glance mapper: empty, one row, variance sign, forbidden/unauthorized |
| Unit (web) | URL builder forces `view=mobile` + page size ≤ server max; empty copy honesty |
| Integration | Optional: list glance under RLS for demo project |
| E2E (Qa-Gate) | Persona smoke: `pm@demo.local` and `field-eng@demo.local` (or superintendent Explore-as-role) open project Job Cost glance; assert slim path (no dependency on client `pageSize=500` join); align `ROLE-PERSONA-MAP.md` |
| Preflight | `./scripts/preflight.ps1 -FullWeb -DotNet` on stamps that touch runtime |

---

## Help center

- Add/adjust cards for “Job cost on phone (PM / field)” with real routes.  
- Do not claim offline job-cost sync beyond truth.  
- Do not advertise Digital Twin / AI / payroll as part of this bar.

---

## Band DoD (major `4.0.0`)

- [ ] People-visible sellability gates (1-3) green or explicit deferred with Chief note  
- [ ] Keep-SoT checklist above satisfied or explicitly deferred with reason in epic/band  
- [ ] OBJECTIVE JC-1…JC-7 (as scheduled on free stamps) complete  
- [ ] Cut list still cut (Gantt edit, portfolio rollups, invented KPIs, Twin/AI theater, payroll sell gate)  
- [ ] Help center updated for user-visible job-cost mobile flow  
- [ ] `docs/ci/pm-4.0.0-acceptance-notes.md` filled  
- [ ] Epic + product-bands README mark 4.0.0 acceptance shipped  
- [ ] Preflight green on last pre-major stamp; health checks documented  

---

## Coordination

| Role | Duty |
|------|------|
| Spec-Writer | Owns this acceptance band; truth over polish |
| Solutions-Lead | Architecture veto locked: combined `/job-cost/glance` phone path; dual lists desktop-only; no `/api/mobile/*`; no cost-codes mega-fetch |
| Api-Engineer | Server DTOs/mappers/endpoints |
| Web-Engineer | Phone UI + nav; remove client mega-fetch join on mobile path |
| Qa-Gate | e2e/smoke gates on named acceptance + ROLE-PERSONA-MAP |
| Release-Ops | Assign JC-* to concrete VERSION stamps when 3.12 opens; never skip |

---

## Related

- Epic ladder: [`docs/roadmap/pm-nextgen-3.4-to-4.0.md`](../../roadmap/pm-nextgen-3.4-to-4.0.md)  
- Band index: [`README.md`](./README.md)  
- Agent-ready bar: [`docs/specs/README.md`](../README.md)  
- Prior mobile DTO pattern: [`band-3.5-pm-rfi-submittal-mobile.md`](./band-3.5-pm-rfi-submittal-mobile.md)  