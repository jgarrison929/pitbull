# GC tool pile → Pitbull 4.0.0 honest replacement map

**Status:** Working GTM claim boundary (Product-GTM)  
**Date:** 2026-09-04  
**Claim law:** [`docs/specs/product-bands/band-4.0.0-acceptance-must-win-field.md`](../specs/product-bands/band-4.0.0-acceptance-must-win-field.md) Keep / Cut / OBJECTIVE (Spec-Writer confirmed aligned to Solutions-Lead). Do **not** sell surfaces outside Keep or unshipped ladder bands without an explicit deferred note.  
**Personas:** [`e2e/fixtures/ROLE-PERSONA-MAP.md`](../../e2e/fixtures/ROLE-PERSONA-MAP.md) + [`docs/ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md) (prefer these over README Explore-as-role copy drift).  
**Rule:** If Qa-Gate cannot assert it and API RLS cannot enforce it, it is not real.

> Packaging / pricing SKUs are **greenfield** — this doc is displacement honesty, not a price sheet.

---

## North star (locked)

**Single-platform job costing + PM mobile-first.**

**OBJECTIVE (must-win for major `4.0.0`):** Mobile job costing via **combined**  
`GET /api/projects/{projectId}/job-cost/glance`  
on the existing `ProjectJobCostController` family, surfaced on **PM + field** tabs — **no** client `pageSize=500` join/aggregation, **no** `/api/mobile/job-cost` resource family.

**Desktop-only (not the phone sell bar):** dual slim lists such as `budgets?view=mobile` + `actuals?view=mobile` may exist for desk workflows — they are **not** the 4.0.0 phone must-win claim.

---

## Personas (demo truth)

| Sell story | Demo login | 4.0.0 job-cost role |
|------------|------------|---------------------|
| Project Manager | `pm@demo.local` | **Primary** must-win glance |
| Field Eng / Foreman (Superintendent Explore-as-role) | `field-eng@demo.local` | **Primary** read-mostly glance |
| CEO / Controller | `ceo@demo.local` | Optional deep-link / role home — not phone ledger |
| CFO (Explore / role_profile) | per ROLE-EXPERIENCE | Optional glance only |
| Contract Admin | `contract-admin@demo.local` | Keep SoT = contracts/SOV/COs + pay-app glance — **not** job-cost tab owner |
| Estimator | `estimator@demo.local` | **Not** primary job-cost owner |
| AR / AP / Payroll | seeded secondaries | Not 4.0 sell-gate personas |

Password: see ROLE-PERSONA-MAP (do not reprint in collateral).

---

## A. What a mid-market GC usually piles up (~20)

| # | Tool category | Typical products |
|---|---------------|------------------|
| 1 | Project docs + RFIs/submittals | Procore, Autodesk Build, Excel logs |
| 2 | Field daily logs + photos | Fieldwire, WhatsApp, camera roll |
| 3 | Drawings / markup | Bluebeam, PlanGrid remnant |
| 4 | Schedule | P6, MS Project, Smartsheet, Excel |
| 5 | Change order log | Excel + email |
| 6 | Owner pay apps (G702/G703) | GCPay, Excel, Procore Financials |
| 7 | Sub pay apps / AP | Same + QuickBooks bills |
| 8 | Job cost / WIP | Excel, Vista, Foundation, Spectrum |
| 9 | Time + labor | ClockShark, ExakTime, Excel |
| 10 | Payroll + certified payroll | ADP/Paychex + LCPtracker |
| 11 | Estimating / bids | HeavyBid, Excel |
| 12 | Contracts / subcontracts | Word + Excel trackers |
| 13 | POs / procurement | Excel, QuickBooks POs |
| 14 | Vendor / insurance COIs | myCOI, spreadsheets |
| 15 | Safety incidents | Paper / SafetyCulture / Excel |
| 16 | Chat / texts | iMessage, WhatsApp, Teams |
| 17 | File dump | Dropbox, Box, SharePoint |
| 18 | Equipment / materials | Excel, fleet apps |
| 19 | Bolted-on “AI” | ChatGPT side-channel, vendor AI demos |
| 20 | Multi-company rollups | Excel consolidations |

---

## B. Honest claims aligned to Keep / OBJECTIVE

### B1. Must-win sell story (OBJECTIVE)

| GC pile | Pitbull surface | Persona | Claim wording (only after OBJECTIVE Done) |
|---------|-----------------|---------|-------------------------------------------|
| **Job cost / WIP Excel (#8)** | `GET /api/projects/{projectId}/job-cost/glance` on **PM + field** mobile tabs; server-computed variance; no client mega-fetch join | PM, Field | “Job cost glance on phone from real budgets/actuals — variance computed on the server.” |

Until glance stamps ship, say we are **closing** the Excel job-cost gap — do **not** say “done,” and do **not** sell dual slim lists as the phone bar.

### B2. Keep surfaces (can claim when shipped / held)

Claim only if the Keep-SoT checklist item is shipped **or** an explicit deferred note exists (never silent orphan).

| # | GC pile | Keep surface | Band / SoT | Honest claim |
|---|---------|--------------|------------|--------------|
| 1 | RFI/submittal “call the office” | Mobile RFI/submittal slim list/detail | **3.5** Keep | Field/PM status on phone without calling the office |
| 2 | Daily log + photo texts | Mobile field/daily report + offline queue | TimeTracking / field paths Keep | Structured reports into the job, not SMS |
| 3 | Plan glance (not Bluebeam) | Plans viewer + pin→draft (prior mobile) | Keep adjacent; not Bluebeam | Open sheets / pin draft — **not** full markup suite |
| 4 | Schedule glance | Gantt glance + Kanban | **3.7** Keep | Critical/today/delayed glance — **not** Gantt edit |
| 5 | CPM honesty | CPM practices | **3.8** (`3.8.1` remapped remainder) | Labeled float/critical honesty |
| 6 | CO email chaos | Mobile CO list/detail/status | **3.6** Keep | CO status with real transitions |
| 7 | Contract/sub trackers | Subcontract/contract mobile glance | **3.6** Keep; Contracts SoT | Status glance — SOV edit stays desk |
| 8 | Sub/owner pay-app chase | Pay-app status glance + deep link | Billing SoT; **3.11** or deferred note | Status only — no phone ledger |
| 9 | Vendor/PO/materials | Vendors / procurement / materials | **3.10** or deferred | Project-scoped glance — not second AP desk |
| 10 | COI expiry Excel | Compliance docs expiry honesty | **3.9** or deferred | Expiry from real docs — no compliance score |
| 11 | Safety paper | Incident capture + list | **3.9** or deferred | Capture into the job record |
| 12 | Bid/quote pipeline | Bids module | **3.11** estimates/quotes or deferred | Real Bids entities — not HeavyBid |
| 13 | Hub hopping | PM hub links | **3.12** | One project hub for PM paper + field loop |
| 14 | Time sheets (capture) | Existing mobile time paths | TimeTracking Keep | Capture remains; **not** payroll product |

### B3. Packaging lead (sellability)

**Lead:** mid-market commercial GC (Summit Commercial Builders archetype) on **job cost on the same platform as PM/field paper** + Keep mobile loop (RFI/CO/schedule glance).

**Demo sequence:** Field Eng / PM Job Cost **glance** (OBJECTIVE) → PM RFI/CO/schedule phone loop → CA pay-app/compliance glance when shipped — one story, ROLE-PERSONA-MAP logins only.

---

## C. Cut — must NOT claim through 4.0.0

| # | GC pile / fantasy | Why cut (acceptance band / SA) |
|---|-------------------|--------------------------------|
| 1 | Desktop-parity Gantt **edit** on phone | Explicit Cut |
| 2 | Phone portfolio / multi-project cost ledger | Explicit Cut — no client rollup |
| 3 | Invented KPIs / “job health” / fake % complete | Explicit Cut |
| 4 | Digital Twin / AI theater as sell gates | Explicit Cut |
| 5 | Payroll / certified payroll as sell gate | Explicit Cut (after core) |
| 6 | Native iOS/Android shell | Explicit Cut — PWA-first |
| 7 | Client `pageSize=500` job-cost join | Anti-pattern; replaced by combined glance |
| 8 | Dual slim `budgets`+`actuals` mobile lists as the **phone** sell bar | Desktop-only — phone must-win is `/job-cost/glance` |
| 9 | New `/api/mobile/job-cost` family | Solutions-Lead NACK — escalate to Chief if proposed |
| 10 | GL / CoA / journal mobile | Out of 4.0 |
| 11 | Full Bluebeam / calibrated markup | Non-goal |
| 12 | Bank cash / treasury | ROLE-EXPERIENCE: AR−AP net ≠ cash |
| 13 | WhatsApp/Teams or Dropbox wholesale | We reduce chase texts; we don’t replace chat/DMS |
| 14 | Claiming bands 3.9–3.12 shipped before they are | Honesty |

---

## D. Acceptance pressure (for collateral / demos)

People-visible 4.0.0 demo must prove:

1. **PM** (`pm@demo.local`) and **field** (`field-eng@demo.local`) open Job Cost from mobile chrome in few taps.  
2. Combined **`/job-cost/glance`** (~390px): cost code, budget, actual, variance from the SA-locked glance contract — **not** dual slim list UIs.  
3. No `pageSize=500` triple fetch / client join on that path.  
4. Honest empty — never “on budget / healthy.”  
5. Keep-SoT checklist in the acceptance band green **or** explicit deferred notes.

Escalate to Chief if Solutions-Lead blocks combined glance or AP-honest cost sources needed to stop lying in WIP (architecture vs sellability tie).

---

## E. Related

| Doc | Role |
|-----|------|
| [`band-4.0.0-acceptance-must-win-field.md`](../specs/product-bands/band-4.0.0-acceptance-must-win-field.md) | Keep/Cut/OBJECTIVE law (Spec-Writer; land on remote if still local-only) |
| [`pm-nextgen-3.4-to-4.0.md`](../roadmap/pm-nextgen-3.4-to-4.0.md) | PM ladder |
| [`financial-math-wip-arc.md`](../roadmap/financial-math-wip-arc.md) | WIP/job-cost math honesty |
| [`DEMO-COMPANY-PROFILES.md`](../DEMO-COMPANY-PROFILES.md) | Demo archetypes |
| [`ROLE-EXPERIENCE.md`](../ROLE-EXPERIENCE.md) | Role UX + truth rules |
