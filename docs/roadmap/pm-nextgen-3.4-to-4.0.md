# Epic: Next-gen Project Management module (3.4.0 → 4.0.0)

**Status:** Pending (program defined; no implementation PRs yet)  
**Product start:** `3.4.0` (shipped checkpoint)  
**Product end:** `4.0.0` (major stamp after runway)  
**Primary UX mandate:** **Mobile-friendly** upgrades for every domain below — phone = capture + glance + filtered drill; PWA-first; no client-side portfolio/ledger aggregation; truth over polish.

**Research (workflows + mobile complaints):** [`docs/roadmap/pm-mobile-workflows-and-complaints-2026.md`](./pm-mobile-workflows-and-complaints-2026.md) — CM/CPM workflow map, ranked 2024–2026 field complaints, complaint→band matrix. Implementers read it before expanding a band.

This document is the **source of truth** for the PM next-gen arc. Do not re-derive the ladder in chat. Expand a band’s product-band spec to agent-ready **before** that band’s first `/goal`.

---

## 1. Problem

Pitbull already has substantial PM and adjacent modules (schedule, RFIs, submittals, contracts, pay apps, procurement, vendors). Much of that UX is desktop-first. Field PMs and supers still bounce to texts/email for RFIs, submittals, COs, schedule glance, safety, and sub/pay status because phone surfaces are incomplete, dense, or dishonest about offline/limits.

**Market evidence (2024–2026, summarized):** supers still “call the office” for RFI status when logs live in spreadsheets; offline is table stakes in basements/high-rises; pocket-first (seconds to load, few taps) beats desktop-shrunk ERP; schedule and drawings must work on phone without promising full desktop Gantt/Bluebeam. Full sources and ranking: research note above.

**This arc does not invent a second ERP.** It **hardens and mobile-upgrades existing modules** first; greenfield only where inventory shows **gap**.

---

## 2. Personas

| Persona | Profile / role | PM needs on phone |
|---------|----------------|-------------------|
| Project Manager | `pm` / Manager | RFIs, submittals, COs, schedule glance, sub pay status |
| Contract Administrator | `contractadmin` / Manager | Main/owner contracts, subcontracts, sub pay apps, insurance & project compliance (Explore-as-role) |
| Superintendent | `superintendent` / field | Safety capture, schedule critical path glance, RFIs, materials on site |
| Controller / CFO | `cfo` | Pay apps, compliance docs, vendor aging (glance only on phone) |
| Estimator | `estimator` | Quotes / bids pipeline (linked; not full desktop estimating) |
| Admin | Admin | Compliance registers; no phone portfolio invent |

---

## 3. In-scope domains (OBJECTIVE — none omitted)

| Domain | Scope note for this arc |
|--------|-------------------------|
| **Submittals** | Mobile list/detail/workflow glance; honest status; no invented “register health” |
| **RFIs** | Mobile list/detail/response capture; plan-pin path already partial (3.1) remains |
| **Vendors** | Mobile-friendly vendor list/detail + project-relevant filter; Billing remains SoT |
| **Compliance** | Certificates / compliance docs glance + expiry honesty (admin + project) |
| **Schedule (Gantt & Kanban)** | Phone-usable Gantt glance + Kanban board for activity/task status; no full desktop Gantt editor on phone |
| **CPM practices** | Critical path recalculate honesty, float display, data-date; label proxies |
| **Safety** | Incident/near-miss capture + list; daily report safety narrative links |
| **Contract management** | Subcontract list/detail mobile; SOV glance (not full SOV edit on phone) |
| **Change orders** | CO list/detail/status capture mobile (owner + subcontract COs as existing APIs allow) |
| **Subcontractor management** | **Pay apps**, **estimates/quotes** (Bids module), **procurement** (POs/invoices) — mobile surfaces; modules stay put |
| **Material tracking** | Deliveries / stored materials / job-site material honesty; link PO + daily report deliveries |

### Explicit non-goals (arc-wide)

- Native iOS/Android / Capacitor shell  
- Full Bluebeam-class plan markup  
- Invented portfolio health / subcontractor scores / fake % complete  
- Reopening Arc A–E (`2.12`→`3.0`) or reclaiming 2.x numbers  
- Relocating Billing → ProjectManagement modules without an explicit later decision  
- Full desktop Gantt feature parity on a 390px screen  
- Dual-writing vendors or pay apps into a new module  

---

## 4. Domain inventory (baseline at 3.4.0)

Statuses: **exists** (API + UI usable on desktop), **partial** (core data/API but weak mobile or incomplete product), **gap** (missing or report-only).

| Domain | Module / API | Web surfaces | Status | Notes |
|--------|--------------|--------------|--------|-------|
| **RFIs** | `Pitbull.RFIs` + PM; `RfisController`; plan pin→draft (3.1) | `/rfis`, `/projects/[id]/rfis` | **partial** | Desktop solid; mobile list/detail incomplete vs field capture bar |
| **Submittals** | `PmSubmittal*`; `api/projects/{id}/submittals` | `/projects/[id]/submittals` | **partial** | API + project page; not phone-first |
| **Vendors** | `Pitbull.Billing` Vendors; `VendorsController` | `/vendors` | **partial** | Exists; desktop-oriented |
| **Compliance** | `ComplianceDocumentsController`; reports | `/admin/compliance`, `/reports/compliance` | **partial** | Register/report; weak mobile PM glance |
| **Schedule Gantt** | `PmSchedule*`; schedules API + critical-path | `/projects/[id]/schedule` | **partial** | Gantt-oriented page exists; phone layout / Kanban **gap** |
| **Schedule Kanban** | Tasks may proxy some columns | `/project-management/tasks/my` | **gap** | No true schedule Kanban board |
| **CPM practices** | Activities: float, `IsCritical`, `critical-path/recalculate`, baselines | schedule page | **partial** | Server CPM bits exist; honesty/UX for float & data-date incomplete |
| **Safety** | `SafetyIncident*` enums; dashboard YTD; daily report safety narrative | `/reports/safety` | **partial** | Capture + project list weak vs report/KPI |
| **Contracts** | `Pitbull.Contracts` Subcontract; `SubcontractsController` | `/contracts`, `/billing/contracts` | **partial** | Desktop; mobile detail/SOV glance missing |
| **Change orders** | `ChangeOrdersController`, `OwnerChangeOrdersController` | `/change-orders`, project COs | **partial** | Exists; mobile approve/status weak |
| **Pay apps** | Payment applications (G702/G703); `PaymentApplicationsController` | `/payment-applications`, contract nested | **partial** | Billing SoT; phone = status glance + deep link |
| **Estimates / quotes** | `Pitbull.Bids` | `/bids` | **partial** | Estimator path; PM sub quotes mobile weak |
| **Procurement** | POs, vendor invoices/payments | `/procurement/*` | **partial** | Ops workspace; project-scoped mobile weak |
| **Material tracking** | Daily report deliveries; pay app stored materials; cost type Material | deliveries OCR on daily reports | **partial → gap** | No first-class material tracking register |

**Module SoT rule:** surface Billing/Contracts/Bids via existing APIs; do not fork entities into PM without a band decision.

---

## 5. Truth rules (every band)

1. No invented executive KPIs or “project health” composites on phone.  
2. Counts and money come from real entities or labeled proxies (`docs/ROLE-EXPERIENCE.md`).  
3. Empty states are honest empty — never fabricate activity.  
4. Offline: only claim what the queue/cache actually holds.  
5. Phone = capture + glance + filtered drill — **no client-side portfolio rollup**.  
6. Demo restrictions stay: `IsDemoUser` + `DemoRestrictionMiddleware`.  
7. Controllers inject `I*Service` — **no MediatR in controllers**.

---

## 6. Railway / deploy safety gates (every PR in this arc)

Implementers **must** satisfy before push/merge. Churn on failed Railway deploys is not acceptable.

### 6.1 Version stamp set (same PR)

| Surface | Action |
|---------|--------|
| root `VERSION` | Exactly one step forward; never skip |
| `src/Pitbull.Web/pitbull-web/package.json` `version` | Match |
| `src/Pitbull.Api/Pitbull.Api.csproj` Version / AssemblyVersion / FileVersion / InformationalVersion | Match |
| Docker `ARG` defaults (API/web Dockerfiles) | Match when present |
| `CHANGELOG.md` | Keep a Changelog entry + ISO published timestamp on release header |

### 6.2 Preflight (local, before push)

```powershell
./scripts/preflight.ps1 -FullWeb -DotNet
```

Fix failures locally. Do not push “hope Railway catches it.”

### 6.3 Residual / buffer stamps

Bands may reserve **buffer** rows (e.g. `*.8` residual honesty, `*.9` checkpoint) for:

- Deploy/CI honesty only  
- SW cache version bumps when client shell changes  
- Copy / empty-state fixes  

**Not allowed:** dumping unrelated features into residual stamps.

### 6.4 Deploy verification (after merge / Railway)

```powershell
curl -sI https://api.pcserp.app/health/live
curl -sI https://demo.pcserp.app/
curl -sI https://app.pcserp.app/
```

See also `docs/ci/pm-arc-deploy-safety.md` and `deploy/RAILWAY-*.md`.

### 6.5 Band DoD (every band checkpoint)

- [ ] All version rows for the band shipped or explicitly deferred in band spec  
- [ ] Help center updated when user-visible flows changed  
- [ ] CI notes under `docs/ci/` for the band checkpoint  
- [ ] Preflight green on last PR; no open deploy-breaking type/build errors  
- [ ] No invented KPIs introduced  

---

## 7. Version ladder (3.4.0 → 4.0.0)

**Rules:** one version = one PR; never skip numbers; expand stub bands to agent-ready before first stamp of that band.

| Band | Versions | Theme | Domains |
|------|----------|-------|---------|
| **3.5** | `3.4.1` → `3.5.0` | RFI + Submittal mobile foundation | RFIs, Submittals |
| **3.6** | `3.5.1` → `3.6.0` | Change orders + contracts mobile | Change Orders, Contract Management |
| **3.7** | `3.6.1` → `3.7.0` | Schedule Gantt phone + Kanban | Schedule (Gantt & Kanban) |
| **3.8** | `3.7.1` → `3.8.0` | CPM practices honesty | CPM Practices |
| **3.9** | `3.8.1` → `3.9.0` | Safety + Compliance mobile | Safety, Compliance |
| **3.10** | `3.9.1` → `3.10.0` | Vendors + Procurement + Materials | Vendors, Procurement, Material tracking |
| **3.11** | `3.10.1` → `3.11.0` | Sub pay apps + estimates/quotes | Subcontractor Management (Pay Apps, Estimates/Quotes) |
| **3.12** | `3.11.1` → `3.12.0` | PM hub integration + residual polish | Cross-domain (all listed surfaces linked from project hub) |
| **Runway** | `3.12.1` → `3.12.9` | Verification + deploy/CI fixes only | No new domain scope |
| **4.0.0** | `3.12.9` → `4.0.0` | Major stamp — next-gen PM bar | Checkpoint only |

**Stamp count (approx):** 10×7 bands + 9 runway + 1 major ≈ **80** PRs. Ruthless scope control: mobile-first **harden**, not rewrite every desktop form.

### First implementable band

Full agent-ready spec:

→ [`docs/specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md`](../specs/product-bands/band-3.5-pm-rfi-submittal-mobile.md)

Next unshipped row: **`3.4.6`** (phone-first Submittal list). RFI detail + confirm-to-submit shipped at **`3.4.5`**.

### Stub band specs (theme + range; expand before first `/goal`)

| Spec file | Status |
|-----------|--------|
| `band-3.6-pm-co-contracts-mobile.md` | Pending stub |
| `band-3.7-pm-schedule-gantt-kanban.md` | Pending stub |
| `band-3.8-pm-cpm-practices.md` | Pending stub |
| `band-3.9-pm-safety-compliance.md` | Pending stub |
| `band-3.10-pm-vendors-procurement-materials.md` | Pending stub |
| `band-3.11-pm-sub-payapps-quotes.md` | Pending stub |
| `band-3.12-pm-hub-polish.md` | Pending stub |
| `band-3.12-runway-and-4.0.0.md` | Pending stub (runway + major) |

---

## 8. Sequencing rationale

```
RFI/Submittal (daily PM traffic)
  → CO/Contracts (money + risk)
  → Schedule Gantt/Kanban (time)
  → CPM honesty (schedule truth)
  → Safety/Compliance (risk & insurance)
  → Vendors/Procurement/Materials (supply)
  → Pay apps + quotes (sub cash + pipeline)
  → Hub polish + runway → 4.0.0
```

Early bands earn adoption; later bands close the office/field money loop without inventing KPIs.

### 8.1 Complaint-driven priority (from research)

| Priority | Market complaint | Band response |
|----------|------------------|---------------|
| P0 | Field cannot list/status RFIs & submittals on phone | **3.5** |
| P0 | Pocket-first usability (not desktop-shrunk) | Acceptance on **every** band |
| P1 | Commercial paper (owner/sub contracts, CO, pay status) mobile-weak | **3.6, 3.11** |
| P1 | Schedule glance / CPM honesty on phone | **3.7, 3.8** |
| P1 | Insurance/compliance expiry for CA/PM | **3.9** |
| P2 | Vendors / procurement / materials field glance | **3.10** |
| Cross | Offline honesty / drawings | Shipped **3.1** residual only — not re-ladder |

Do **not** reorder the version spine in chat. Expand research → band acceptance only.

---

## 9. How to run a `/goal` in this arc

1. Open this epic + the **current band** product-band spec.  
2. Take the next unshipped version row only.  
3. Meet agent-ready checklist for that row (`docs/specs/README.md`).  
4. Ship with full stamp set + preflight.  
5. Update band status when a checkpoint merges.

**Copy-paste goals:** [`docs/340-pm-arc/goal-prompts.md`](../340-pm-arc/goal-prompts.md)

---

## 10. Related

| Doc | Role |
|-----|------|
| [`docs/roadmap/pm-mobile-workflows-and-complaints-2026.md`](./pm-mobile-workflows-and-complaints-2026.md) | **Research:** CM/CPM workflows + ranked mobile complaints |
| [`docs/specs/product-bands/README.md`](../specs/product-bands/README.md) | Band index |
| [`docs/specs/README.md`](../specs/README.md) | Agent-ready bar |
| [`docs/ci/pm-arc-deploy-safety.md`](../ci/pm-arc-deploy-safety.md) | Deploy gates short form |
| [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | Module map |
| [`docs/ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md) | Persona UX + truth |
| [`docs/mobile3.md`](../mobile3.md) | Field mobile principles |
| [`docs/roadmap/mobile-field-demand-stack-and-version-plan.md`](./mobile-field-demand-stack-and-version-plan.md) | Prior G1–G5 field demand (3.1/3.3) |
| [`docs/260712/VERSION-WORKFLOW.md`](../260712/VERSION-WORKFLOW.md) | Historical 3.0 program (do not reopen) |
| [`docs/roadmap/post-3.0-product-bands.md`](./post-3.0-product-bands.md) | Older theme parking lot |

---

## 11. Program decision (locked)

```text
Next-gen PM arc = mobile-friendly upgrade of OBJECTIVE domains above.
Ladder: 3.4.1 → … → 3.12.9 runway → 4.0.0 major.
One PR = one VERSION stamp. Never skip.
No feature dump on residual/runway stamps.
Billing/Contracts/Bids remain module SoT for money/vendor/quote data.
```
