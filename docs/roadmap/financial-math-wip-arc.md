# Arc: Financial math integrity (WIP-first)

**Status:** Planned (inventory + first continuous review workflow shipped)  
**Problem:** Demo/live WIP lines show calculation errors — wrong % complete scale, incomplete cost/billing sources, and seed data that does not join real contracts/billings/costs.  
**Mandate:** Truth over polish. Label proxies honestly. Do not invent executive KPIs.

**Continuous review:** `.grok/workflows/financial-math-review.rhai` — loops domain shards (WIP formulas, cost source, billings, COs, seed integrity, UI scale, adjacent GL) with no `pause`/`await_user` gates; ends on dry rounds or agent budget.

---

## 1. WIP calculation surfaces (inventory)

| Surface | Path | What it does today | Math risk |
|---------|------|--------------------|-----------|
| Line calc | `src/Modules/Pitbull.Billing/Services/WipCalculationService.cs` | Cost-to-cost %; earned = revised × %; over/under = earned − billed | Source gaps (below) |
| Report generate/update | `src/Modules/Pitbull.Billing/Services/WipReportService.cs` | Calls calc; writes EV fields; surety export | Inherits calc; CPI = earned/cost (nonstandard vs BCWP/ACWP) |
| Contracts/DTOs | `src/Modules/Pitbull.Billing/Features/Wip/WipContracts.cs` | Line + surety DTOs | % assumed unit fraction |
| GL post | `src/Modules/Pitbull.Billing/Features/Wip/WipGlPostingService.cs` | JE for over/under | Posts wrong AR/revenue if over/under wrong |
| UI | `src/Pitbull.Web/.../accounting/wip/[id]/page.tsx` | `formatPercent(v) => (v * 100)%` | Double-scales if value is already 0–100 |
| Unit tests | `tests/Pitbull.Tests.Unit/Services/WipCalculationServiceTests.cs` | Happy path only | Does not lock owner CO / full job cost / gross billings |
| Seed WIP | `SeedDataService.CreateWipReports` | Fabricates lines from schedule EV profiles | Not derived from TimeEntry / BillingApplication / real COs |

### Formula (service) — intended cost-to-cost

```
RevisedContract = Project.ContractAmount + Σ Approved(subcontract ChangeOrder)
TotalCostToDate = Σ Approved TimeEntry labor OT/DT + equipment hours×rate
EstimatedTotalCost = TotalCostToDate + max(0, ECTC)
PercentComplete = clamp(TotalCostToDate / EstimatedTotalCost, 0, 1)   // unit fraction
EarnedRevenue = RevisedContract × PercentComplete
BilledToDate = Σ over owner contracts of latest-app TotalEarnedLessRetainage (submitted+; not sum of all apps)
OverUnder = EarnedRevenue − BilledToDate
```


---

## 2. Confirmed / evidenced issues

| ID | Severity | Issue | Evidence |
|----|----------|-------|----------|
| M0 | **fixed (B0)** | **BilledToDate double-counted multi-app projects:** was `Sum(TotalEarnedLessRetainage)` across all billable apps, but G702 Line 6 is **cumulative per app**. Now latest `ApplicationNumber` per owner contract (dashboard pattern), field still net TELR. | `WipCalculationService` billed selection; `RoleDashboardSummaryService.ComputeBilledToDateAsync`; gap test `BilledToDate_UsesLatestCumulative…` |
| M1 | **critical** | Seed `PercentComplete` / `EvPercentComplete` stored as **0–100 points**; calc + UI use **0–1 fraction**. Seeded WIP displays ~100× too large (e.g. 52.5 → `5250%`). PDF uses `:N1%` without ×100 (opposite). CostPrediction divides by % assuming 0–1. | `CreateWipReports`; UI `formatPercent`; `PdfReportService`; `CostPredictionService` |
| M2 | **critical** | Seed WIP lines are **synthetic** (2% CO, random billed near earned, profile cost efficiency) — not joined to owner contracts, billing apps, time entries, or CO rows. Regenerate/recalc will disagree with stored seed reports. | `CreateWipReports` ~L3392–3473; no query of `BillingApplication` / `TimeEntry` |
| M3 | **high** | `ApprovedChangeOrders` sums **subcontract** `ChangeOrder` only — ignores `OwnerChangeOrder` and `OwnerContract.ApprovedChangeOrderAmount`. Sub COs inflate owner revenue base. | `WipCalculationService` L26–34; `OwnerChangeOrder` entity exists; seed never creates `OwnerChangeOrder` rows |
| M4 | **high** | `TotalCostToDate` = approved **TimeEntry** labor+equipment only. Missing sub pay apps (`PaymentApplication`), vendor invoices, PO receipts, materials, other job cost. Sparse time → near-zero cost → bogus % complete / earned. | `WipCalculationService` L53–63; no PaymentApplication/VendorInvoice |
| M5 | **high** | Seed owner CO amount is a **scalar** on contract (`ContractAmount * 0.02`) with **no** `OwnerChangeOrder` entities; WIP seed uses same 2% heuristic independently. | `CreateOwnerContracts` L3200; no `OwnerChangeOrder` in SeedData |
| M6 | **medium** | Billed-to-date field is net retainage (`TotalEarnedLessRetainage`). Surety WIP often wants **gross** completed-and-stored; net understates billings and inflates underbilling. Re-validate for bonding export after M0 fix. | Calc L48–51; matrix WIP sourcing note |
| M7 | **medium** | Seed billing retainage: `retOnWork = contractSum * retPct` (full contract) every app, not retainage on work completed; `LessPreviousCertificates` / `CurrentPaymentDue` inconsistent with live `BillingApplicationService` G702. | `CreateBillingApplications` L3295–3345 |
| M8 | **medium** | Seed retention holds: retained = `CurrentValue * retPct` (full sub value), not billings×rate. | `CreateRetentionHolds` L3496–3497 |
| M9 | **medium** | WIP GL posts full `OverUnderBilling` each period with no reverse/delta of prior WIP JE — successive monthly posts compound. | `WipGlPostingService` |
| M10 | **low** | CPI defined as `EarnedRevenue / TotalCostToDate` (revenue per cost $). Traditional EV CPI is BCWP/ACWP in cost space — label honestly in UI if kept. | `WipReportService.ApplyCalculatedValues` |
| M11 | **low** | Existing happy-path unit test uses one billable app + subcontract CO only — misses M0/M3. Gap tests under `WipCalculationSourceGapTests`. | tests |
| M12 | **high** | `GenerateWipReportAsync` defaults ECTC to **0** when estimates omitted → any cost ⇒ 100% complete and full earned revenue. | `WipReportService` L241–243 |
| M13 | **high** | WIP GL resolves accounts **1400/2400**; chart/seed put costs/billings in excess on **1200/2200** (1400=equipment, 2400=notes payable). Type checks still pass. | `WipGlPostingService.ResolveWipAccountsAsync`; CoA template |

---

## 3. Seed / dataset relationship matrix

| Entity | Seeded? | Linked to WIP calc? | Linked to seed WIP lines? | Gap |
|--------|---------|---------------------|---------------------------|-----|
| Project.ContractAmount | Yes | Yes (base contract) | Yes (base) | OK |
| OwnerContract + SOV | Yes | **No** (calc uses Project) | No | Contract sum / CO on owner not SoT for WIP |
| OwnerChangeOrder rows | **No** | **No** | No | Fabricated 2% only |
| Subcontract ChangeOrder | Yes (elsewhere in seed) | Yes if Approved | Seed uses 2% not Σ CO | Relationship weak |
| BillingApplication | Yes | Yes (net earned) | **No** (random billed) | Seed WIP ≠ AR |
| TimeEntry approved | Yes | Yes (only cost) | **No** | Seed cost ≠ time |
| PaymentApplication (sub AP) | Yes | **No** | No | Job cost hole |
| VendorInvoice / PO | Yes | **No** | No | Job cost hole |
| WipReportLine | Yes (6 periods) | N/A stored snapshot | Self-consistent fake story | Diverge on Generate |
| RetentionHold | Yes | Not in WIP line | N/A | Overstated retainage |

**DB check (this environment):** PostgreSQL `localhost:5432` not reachable (timeout). Inventory relies on seed source + unit tests. Re-run SQL sample when demo DB is up:

```sql
-- Compare one project: seed WIP billed vs Σ billings vs calc sources
SELECT p."Number",
       w."BilledToDate" AS seed_billed,
       w."TotalCostToDate" AS seed_cost,
       w."PercentComplete" AS seed_pct,
       (SELECT COALESCE(SUM(b."TotalEarnedLessRetainage"),0) FROM "BillingApplications" b
         WHERE b."ProjectId" = p."Id") AS ar_net_earned,
       (SELECT COUNT(*) FROM "OwnerChangeOrders" o WHERE o."ProjectId" = p."Id") AS owner_co_rows
FROM "WipReportLines" w
JOIN "Projects" p ON p."Id" = w."ProjectId"
ORDER BY w."CreatedAt" DESC
LIMIT 20;
```

---

## 4. Ordered ladder — plan → implement → resolve

Align stamps with live product VERSION rules (`CONTRIBUTING` / current arc VERSION-WORKFLOW). One concern per PR.

| Step | Band intent | Scope | Done when |
|------|-------------|-------|-----------|
| **P0** | Spec lock | Agent-ready band: unit fraction %; owner vs sub CO; job-cost sources; latest-app vs sum billings; gross vs net for surety | Spec merged |
| **B0** | **Hotfix: billed double-count** ✅ | `BilledToDate` = latest billable app per owner contract (cumulative TELR), matching dashboard — **not** sum of all apps | Multi-app unit test; demo multi-period billings correct |
| **B0b** | ECTC default + GL accounts | Require/estimate ECTC (or use job budget remainder); map WIP GL to 1200/2200 (or config) not 1400/2400 | Generate without estimates not 100% complete; GL hits correct accounts |
| **B1** | Scale + seed honesty | Seed `%` as 0–1; stop fabricating billed/cost when live sources exist **or** label snapshot; OwnerChangeOrder rows for 2% story | Demo WIP % sane; CO rows exist |
| **B2** | Calc: contract revision | Owner COs / `OwnerContract` for revised revenue; sub COs not as owner revenue | Owner CO tests green |
| **B3** | Calc: cost-to-date | Time + AP pay apps + vendor invoices + documented exclusions | Cost reflects AP-only jobs |
| **B4** | Calc: billings policy | After B0: optional gross vs net columns for surety; UI labels | Matrix + export honest |
| **B5** | Seed billing/retention | Retainage-on-work; G702 cascade; retention from pay apps | Seed G702 ±$0.01 vs service |
| **B6** | UI + PDF + predictions | `formatPercent` 0–1 only; PDF scale; CostPrediction; CPI honesty | No 1000%+ / 0.5% misprints |
| **B7** | GL + regression | Period delta or reverse prior WIP JE; re-run workflow | `Wip*` tests green; workflow dry/low |

### Explicit non-goals (this arc)

- Rewriting all of Billing/GL or PM next-gen ladder  
- Perfect surety filing package in first band  
- Live Railway mutation for seed repair without a versioned PR  

---

## 5. How to re-run continuous review

```text
# Smoke
workflow: financial-math-review validate_only args={focus:"WIP", max_rounds:2}

# Bounded continuous loop (no human gate)
workflow: financial-math-review args={focus:"WIP and seed relationships"} agent_budget=96
```

Saved definition: `.grok/workflows/financial-math-review.rhai`.

---

## 6. Related docs

| Doc | Role |
|-----|------|
| `docs/WORKFLOW-EVALUATION-MATRIX.md` | Owner AR vs sub AP; WIP billed source decision |
| `docs/DEMO-COMPANY-PROFILES.md` | Demo portfolio story (WIP/bonding) |
| `docs/ROLE-EXPERIENCE.md` | CFO → `/accounting/wip` |
| `docs/roadmap/pm-nextgen-3.4-to-4.0.md` | Orthogonal PM arc — do not subsume finance here |
