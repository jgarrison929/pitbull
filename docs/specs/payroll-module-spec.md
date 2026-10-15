# Spec: Pitbull.Payroll module

**Status:** Draft
**Date:** 2026-09-02
**Owner:** Joshua Garrison
**Related:** `docs/ADDING-A-MODULE.md`, `docs/ARCHITECTURE.md`, `docs/architecture/TIME-TRACKING-DESIGN.md`, `docs/roadmap/financial-math-wip-arc.md`
**Stack (living):** .NET 10, Next.js 16, PostgreSQL 17, Railway. Modular monolith: 14 class libs today, one API host, one EF context, one Next app.

This is the implementable product/engineering spec for a first-party `Pitbull.Payroll` module. It is not a version-band PR plan and not an implementation.

---

## Non-goals

- Do not adopt ERPNext, Frappe, or Odoo as the payroll product or runtime.
- Do not copy GPL / OEEL source. Steal module *patterns* only (overlay pack, versioned rule parameters, provider adapter).
- Do not maintain IRS Publication 15-T (or any jurisdiction table) by hand.
- Do not build a 3,000-jurisdiction US payroll tax calculator in-house. Out of scope for the v1 engine.
- Do not scrape IRS / state DOR sites. Automatic tax updates = vendor feed.
- Do not treat Billing `TaxJurisdiction` / `TaxRate` as payroll tax. Those are sales tax on POs and vendor invoices.
- Do not keep `TotalNet = TotalGross` once a tax pack is wired (P2). Until then, net must be labeled a proxy, not a paycheck.
- Do not use `Employee.Title` or `EmployeeClassification` (office/field enum) as WH-347 trade class.
- Do not make certified-job detection "has a WageDetermination row". That becomes `Project.CertifiedPayroll`.
- Out of v1: 401(k) / garnishments beyond union deductions, multi-EIN payroll, LCPTracker/Elation e-file, non-US country packs, rewriting Billing GL, PM next-gen ladder.

---

## 1. Problem

Payroll today is a Billing feature with TimeTracking inputs. It cannot pay a union crew correctly and cannot file a real WH-347.

| Capability | Score | What the code does |
|------------|------:|--------------------|
| Union wage packages | 1/5 | `EmployeeUnionAffiliation` exists on onboarding. Unused in calc. Free-text local/craft. No CBA, no scale, no zone, no fringe buckets. |
| Certified payroll | 2/5 | Generate/list APIs and a WH-347-labeled homemade PDF. Lines are DTOs, not persisted. FICA hardcoded 7.65%, withholding 12%. Classification = Title/enum. |
| Tax table updates | 0/5 | No payroll tax tables. No Hangfire tax updater. No vendor. |
| Multi-state withholding | 0/5 | `Project.State` unused for payroll. W-4 stored, unused. Work-state vs residence-state does not exist. |
| Job costing to payroll | 3/5 | Time entries have project + cost code + ST/OT/DT. Run groups by employee and drops job/cost code. Export reallocates hours later. No GL post. |

Calc path today:

1. Approved time entries in the pay period.
2. Group by employee. Drop project and cost code.
3. Rate = `Employee.BaseHourlyRate` for every hour.
4. ST + 1.5x OT + 2.0x DT. `TotalNet = TotalGross`.
5. Job-cost side: `LaborCostCalculator` uses the same base rate, then a flat 35% burden. Comments mention FICA / FUTA / SUTA / WC. None of those are computed.
6. Certified PDF invents FICA and withholding. `PrevailingWageValidationService` exists, is not on HTTP, and uses the first active `WorkClassification`.
7. Export enum says Adp / Paychex / QuickBooks. Writer still emits generic CSV. `WorkClassificationId` is null. Deductions = 20% of gross.

`EmployeeUnionAffiliation` and `EmployeeTaxCompliance` (W-4) are collected in onboarding and ignored at payday. `FringeBenefitAllocation` has a table and no service. `WorkClassification` is company-scoped and seeded, with no dedicated CRUD, and is not on the time entry or the pay line.

This is not a payroll engine. It is a hours rollup with a PDF costume.

### Why not ERPNext or Odoo

Stay on Pitbull. Construction ERP here is already .NET 10 + Next.js + PostgreSQL on Railway: time, cost codes, projects, certified-adjacent UI, GL chart (including 2100 Accrued Payroll and 2150 Payroll Taxes Payable), permissions, and a PayrollSpecialist role. Ripping that out for Frappe or Odoo means a second product, a second tenant model, and GPL/OEEL license drag on the differentiators we actually sell (union packages and certified payroll).

What we steal is structure, not source:

| Source | Pattern to copy | What we do not copy |
|--------|-----------------|---------------------|
| ERPNext `india-payroll` overlay app | Country/domain rules as an overlay pack on a generic engine. Core payroll does not `if (usa)`. | Frappe, DocTypes, GPL code, Indian statutory forms. |
| Odoo payroll | Engine + versioned rule parameters + `l10n` pack + provider adapter for tax content. | Odoo runtime, OEEL modules, Python rule trees. |

US tax *content* is bought (Symmetry / Vertex / Check, or ADP / Paychex as tax system of record). Union rates and certified payroll are first-party Pitbull.

---

## 2. Target architecture

New module: `Pitbull.Payroll` (15th class lib). Same host, same `PitbullDbContext`, same Next app. Controllers stay in `Pitbull.Api` with direct `I*Service` injection. No MediatR in controllers. Overlay packs are data + services registered next to the engine, not `if` branches inside `PayrollRunService`.

```
TimeTracking (hours, employee, pay period)
        |
        v
Pitbull.Payroll engine
  documents: Pay Component, Pay Structure, Pay Run, Pay Slip
        |
        +-- Union pack (data + services)
        |     Union Agreement, Wage Package, date-effective rates
        +-- US tax pack (data + services + vendor adapter)
        |     Tax Table Version, W-4 application, work vs residence state
        +-- Certified payroll (first-party, not a country overlay)
              persisted lines, WH-347, Statement of Compliance, PW validator
        |
        v
Billing GL  (journal post, P3)     Projects / cost codes (job cost stays on the line)
```

### Canonical documents

| Document | Role |
|----------|------|
| **Pay Component** | Atomic earning, deduction, or employer contribution (ST, OT, DT, cash fringe, H&W, pension, union dues, federal WH, FICA EE/ER). Flags: taxable, reportable, fringe, cash vs benefit, certified-visible. |
| **Pay Structure** | Ordered set of components for a class of work (union package, prevailing-wage, or company default). Parameters are versioned by effective date. |
| **Union Agreement** | CBA header: local, craft jurisdiction, effective/expiration, geographic scope. |
| **Wage Package** | Date-effective rates for (agreement + craft/class + scale/step + zone + shift): base, fringe buckets, travel, subsistence. |
| **Tax Table Version** | Imported vendor snapshot: vendor, jurisdiction, effective date, content hash, imported-at. Engine never authors tax rows. |
| **Pay Run** | Period batch. Successor of `PayrollRun`. Holds slips, not a single gross. |
| **Pay Slip** | Per-employee result of a run: lines by component, hours by job/cost code/class, taxes, net. Successor of `PayrollRunLine`. |

Nav stays `/payroll/runs`, `/certified`, `/wage-determinations`, `/reviews`, `/exports`. Add `/payroll/agreements`, `/payroll/packages`, `/payroll/classifications`, `/payroll/tax-tables` when those CRUDs ship.

---

## 3. Domain model

All new entities: `BaseEntity`, tenant + company scoped, UTC timestamps, `decimal(18,2)` money, `decimal(18,4)` rates, string enums, no `RenameColumn` in migrations. Date-effective rows use `EffectiveDate` + optional `ExpirationDate`. Lookup is "latest effective on work date, not expired".

### 3.1 Entities and fields

**WorkClassification** (exists; promote)

| Field | Notes |
|-------|-------|
| Code, Name, Description, IsActive | Keep. |
| Craft, ClassName | Trade class for CBA / WD / WH-347 (e.g. Laborer Group 3, Operating Engineer Group 3). Not `Employee.Title`. |
| Apprenticeable | Whether scale/step applies. |

Dedicated company-scoped CRUD. Seeded rows remain; they are no longer write-once.

**UnionAgreement** (new)

| Field | Notes |
|-------|-------|
| UnionName, LocalNumber | e.g. Laborers Local 270. |
| InternationalBody | Optional (LIUNA, IUOE, IBEW). |
| AgreementNumber / Name | CBA identifier. |
| Jurisdiction | Geographic text + optional state. |
| EffectiveDate, ExpirationDate | Required effective. |
| Status | Active / Expired / Superseded. |

**WagePackage** (new) — child of agreement, the rate card.

| Field | Notes |
|-------|-------|
| UnionAgreementId | Parent CBA. |
| WorkClassificationId | Craft/class. |
| ScaleCode | Journeyman, apprentice step 1..n, foreman. |
| ZoneCode | Optional (zone 1, "inside 50 miles"). |
| ShiftCode | 1st / 2nd / 3rd / special. |
| EffectiveDate, ExpirationDate | Date-effective. |

**WagePackageRate** (new) — money rows on a package.

| Field | Notes |
|-------|-------|
| WagePackageId | Parent. |
| PayComponentId | Which component this rate feeds. |
| HourlyRate or Amount | Hourly for wages/fringe; amount for per-day subsistence. |
| Unit | PerHour / PerDay / PerMile / PerShift. |
| FringeMethod | Cash / Benefit / Split. |

**PayComponent** (new)

| Field | Notes |
|-------|-------|
| Code, Name | Stable code (`ST`, `OT`, `DT`, `FRINGE_CASH`, `HW`, `PENSION`, `DUES`, `FIT`, `SIT`, `FICA_EE`, `FICA_ER`, `FUTA`, `SUTA`, `TRAVEL`, `SUBSIST`). |
| Kind | Earning / Deduction / EmployerContribution. |
| IsTaxable, IsReportableOnCertified, IsFringe, IsCash | Drive WH-347 and tax input. |
| OverlayPack | `core` / `union` / `us_tax`. |

**PayStructure** (new)

| Field | Notes |
|-------|-------|
| Name, Status | Active / Draft. |
| Source | UnionPackage / PrevailingWage / CompanyDefault. |
| UnionAgreementId / WageDeterminationId | Optional pointers. |
| EffectiveDate, ExpirationDate | Versioned parameters. |

**PayStructureLine** (new): PayStructure + PayComponent + sequence + parameter set (multiplier 1.5 for OT, formula key). No `if-usa` in the run service; the pack supplies the component set.

**EmployeeUnionAffiliation** (exists in TimeTracking; extend, do not replace)

Keep onboarding collection. Stop using free-text as the rate key.

| Add | Notes |
|-----|-------|
| UnionAgreementId | FK. `LocalNumber` / `UnionName` become denormalized display. |
| WorkClassificationId | Replaces free-text ClassificationCode as the key. |
| ScaleCode | From `ApprenticeLevel`. |
| MemberId | Keep. |
| EffectiveDate, EndDate | Already present; required for lookup. |

**EmployeeTaxCompliance** (exists; stays in TimeTracking)

W-4 fields become inputs to the US tax pack in P2: `W4FilingStatus`, `W4AdditionalWithholding`, `W4Exempt`. Add residence state (and optional locality) on this record or on Employee. I-9 stays HR, not payroll calc.

**TimeEntry** (TimeTracking)

| Add | Notes |
|-----|-------|
| WorkClassificationId | Required when the project is certified or the employee has an active union affiliation covering that date. Optional on private non-union. |
| ShiftCode | Optional; default 1st. Zone comes from project (or GPS later), not from the worker typing it. |

Cost code, project, ST/OT/DT stay. They survive onto the pay slip line. They must not be dropped at run generation.

**PayRun** (rename conceptually of `PayrollRun`)

| Field | Notes |
|-------|-------|
| PayPeriodId, RunDate, Status | Keep status machine: Draft -> Processing -> Submitted -> UnderReview -> Approved -> Exported. Add Posted (GL). |
| TotalGross, TotalNet, EmployeeCount | Keep. After P2, TotalNet is computed, not copied. |
| TaxTableVersionId | Set when a tax pack ran. Null in P0/P1. |

**PaySlip** (successor of `PayrollRunLine`)

| Field | Notes |
|-------|-------|
| PayRunId, EmployeeId | One slip per employee per run. |
| TotalHours ST/OT/DT, Gross, TotalDeductions, TotalTaxes, Net, EmployerCost | Net is Gross - deductions - employee taxes. |
| RateSource | UnionPackage / PrevailingWage / PayStructure / FallbackBaseRate. Fallback is a defect on union/certified work. |

**PaySlipLine** (new; this is the job-cost grain)

| Field | Notes |
|-------|-------|
| PaySlipId | Parent. |
| TimeEntryId | Optional trace back. |
| ProjectId, CostCodeId, WorkClassificationId | Required for costing and certified. |
| PayComponentId | ST/OT/DT/fringe/tax/etc. |
| Hours, Rate, Amount | Rate from package/WD, not BaseHourlyRate when a package hits. |
| WagePackageId / WageDeterminationRateId | Whichever sourced the rate. |

**CertifiedPayrollReport** (exists; extend)

| Add | Notes |
|-----|-------|
| StatementOfCompliance* | See section 5. |
| Lines persisted | `CertifiedPayrollLine` table, not a DTO-only generate result. |

**CertifiedPayrollLine** (new)

| Field | Notes |
|-------|-------|
| ReportId, EmployeeId, WorkClassificationId, ProjectId | Real class. |
| ST/OT/DT hours and rates | From slip lines, not Title-derived. |
| Gross, CashFringe, BenefitFringe, Deductions, Net | From components. |
| PaySlipId | Trace. |

**FringeBenefitAllocation** (exists; give it a service)

Keep. RequiredFringeRate vs CashFringeAmount vs BenefitFringeAmount. Tie to PaySlipLine / CertifiedPayrollLine. AllocationMethod Cash / Benefits / Split stays.

**WageDetermination** / **WageDeterminationRate** (exist)

Keep as the non-union / public-work rate card (Davis-Bacon / state DIR). Still project-scoped. Rates stay base + fringe + total, keyed by WorkClassificationId. Manual CRUD remains until a WD content vendor is a later open question. Seed that pretends to be CA DIR must be labeled seed, not DIR.

**TaxTableVersion** (new, US tax pack)

| Field | Notes |
|-------|-------|
| Vendor | Symmetry / Vertex / Check / Adp / Paychex. |
| JurisdictionKey | Federal, state code, locality id as the *vendor* names it. |
| EffectiveDate, ImportedAt, ContentHash, Status | Active / Superseded. |
| ExternalVersion | Vendor's version string. |

No tax rate rows authored by Pitbull.

**Project** (Projects module)

| Add | Notes |
|-----|-------|
| CertifiedPayroll | bool, default false. True = WH-347 + PW validation required. |
| WorkState | Use existing `State` as work-state. Do not add a second state field unless residence needs it on the project (it does not). |

PW applies when `CertifiedPayroll` is true. A WageDetermination is required on those jobs before a run can approve. Private jobs may still attach a WD; the flag is the switch, not the FK.

### 3.2 Relationships (short)

- UnionAgreement 1--* WagePackage *--1 WorkClassification
- WagePackage 1--* WagePackageRate *--1 PayComponent
- EmployeeUnionAffiliation *--1 UnionAgreement, *--1 WorkClassification
- TimeEntry *--1 WorkClassification, *--1 Project, *--1 CostCode
- PayRun 1--* PaySlip 1--* PaySlipLine
- PaySlipLine *--1 PayComponent, *--1 Project, *--1 CostCode, *--1 WorkClassification
- CertifiedPayrollReport *--1 PayRun *--1 Project; 1--* CertifiedPayrollLine
- PayRun *--1 TaxTableVersion (P2)
- WageDetermination 1--* WageDeterminationRate *--1 WorkClassification

### 3.3 Rate lookup (job + CBA + class, not BaseHourlyRate)

Work date = time entry date. Inputs: employee, project, WorkClassificationId, shift, zone (from project), scale (from affiliation).

1. **Classification.** Time entry `WorkClassificationId`. If missing and (`Project.CertifiedPayroll` or employee has an active affiliation on that date) -> reject the entry from the run with a typed error, do not guess "first active classification".
2. **Union package.** Active `EmployeeUnionAffiliation` covering work date whose `UnionAgreementId` is in force, matching classification + scale. Resolve WagePackage by agreement + class + scale + zone + shift, date-effective. Apply WagePackageRate rows onto Pay Components (ST base, OT/DT multipliers from structure, fringe buckets, travel/subsistence rules).
3. **Prevailing wage.** Else if `Project.CertifiedPayroll` (or an active WD on the project for public work without a CBA match): active `WageDetermination` for the project covering work date; rate for this WorkClassificationId (base + fringe). Fringe goes to FringeBenefitAllocation per employee/project method.
4. **Company Pay Structure.** Else the employee's default PayStructure (non-union private).
5. **Fallback.** `Employee.BaseHourlyRate` only when none of 2-4 match *and* the job is not certified. If this fires on a certified or union row, the run cannot leave Draft.

OT/DT multipliers live on the Pay Structure (default 1.5 / 2.0) and may be overridden by the agreement. They are not hardcoded in the run service.

`LaborCostCalculator` (TimeTracking) keeps its current 35% behavior until P3, then must call the same rate lookup so job cost and payroll stop diverging.

---

## 4. Union wage packages

First-party differentiator. P0 deliverable. Overlay pack name: `union`.

### 4.1 Local, craft/class, scale/step

- Local = `UnionAgreement.LocalNumber` + name. One company can have many locals.
- Craft/class = `WorkClassification` (Laborer Group 1, Cement Mason, OE Group 3). Not job title.
- Scale/step = `WagePackage.ScaleCode` + affiliation `ApprenticeLevel`. Journeyman is a scale, not a missing apprentice flag.
- An employee can hold multiple affiliations with date ranges (already on the entity). Lookup uses the one covering the work date for that class. Two active overlapping affiliations for the same class is a data error; block save.

### 4.2 Fringe vs cash

Required fringe is an hourly amount on the package (or WD). How it is satisfied:

| Method | Pay slip | Certified column |
|--------|----------|------------------|
| Benefit | EmployerContribution components (H&W, pension, training, annuity, vacation fund). Not in gross. | Benefit fringe paid. |
| Cash | Earning `FRINGE_CASH`. In gross, taxable per tax pack. | Cash fringe in lieu. |
| Split | Both. `FringeBenefitAllocation` stores the split. | Both columns. |

`FringeBenefitAllocation` becomes the per-employee / per-project method record. If required fringe > benefit paid, residual is cash-in-lieu. If benefit paid > required, certified shows excess; do not reduce wages.

### 4.3 Zone and shift

- Zone is a property of the *job* (project address / mile radius), not of the employee. Package rows are keyed by ZoneCode. Unspecified zone uses the agreement default.
- Shift is on the time entry (default 1st). 2nd/3rd premiums are Pay Components with rates on the package, not a multiplier buried in BaseHourlyRate.
- GPS on time entry is evidence, not the rate key, in v1.

### 4.4 Travel and subsistence

Separate Pay Components (`TRAVEL`, `SUBSIST`) with Unit PerMile / PerDay / PerShift. Rules live as WagePackageRate rows (amount + unit + optional zone). They appear on the slip and on certified if the agreement says they are wages or reimbursements. v1: manual hours/miles on the time entry or a simple allowance flag — not a mapping engine.

### 4.5 Services (union pack)

- `IUnionAgreementService` — CRUD agreements.
- `IWagePackageService` — CRUD packages + date-effective rates.
- `IWorkClassificationService` — dedicated CRUD (today: seed only).
- `IWageRateResolver` — implements section 3.3. Used by run generation, PW validator, and (P3) labor cost. No other service is allowed to read `BaseHourlyRate` for union/certified work.

---

## 5. Certified payroll / WH-347

First-party differentiator. P1 deliverable. Current score 2/5: homemade PDF, no persisted lines, fake tax, fake class.

### 5.1 Persist lines

`CertifiedPayrollReport` stays. Generate writes `CertifiedPayrollLine` rows and returns them. List/get returns stored lines, not a recomputed DTO. PDF reads stored lines. Regenerating a Draft report replaces lines; Submitted reports are immutable.

### 5.2 Real class and fringe

Each line: employee, WorkClassification (code + name), ST/OT/DT hours and rates from PaySlipLine, gross, cash fringe, benefit fringe, deductions, net. Classification is never `Employee.Title` and never `EmployeeClassification.ToString()`.

Fringe comes from `FringeBenefitAllocation` + employer components, not from a PDF constant.

### 5.3 Statement of Compliance

Store on the report (WH-347 / WH-348 attestation), not only in the PDF footer:

- Signer name, title, signature timestamp, signed-by user id.
- Exceptions / remarks text.
- Fringe-benefit statement: paid to plans vs cash in lieu (plan names optional in P1).
- Week ending, payroll run id, project id, WHD form number (default WH-347).

Approve/submit of a certified report requires the statement fields. PDF prints them.

### 5.4 Project.CertifiedPayroll

New bool on Project. Default false.

- True: time entries on that job require WorkClassificationId; run approve must pass PW validation; a CertifiedPayrollReport can be generated; a WageDetermination covering the period is required unless a UnionAgreement package is the rate source *and* meets or exceeds the WD.
- False: certified generate is rejected for that project. Private work.

Do not infer this from "a WageDetermination row exists". Attach WD as the rate source; the flag is the legal posture.

### 5.5 Wire the existing validator

`PrevailingWageValidationService` already compares run rates to WD totals. Changes:

- Expose HTTP: `POST /api/payroll/runs/{id}/validate-prevailing-wage` (`Payroll.Process` or `Payroll.CertifiedReport`).
- Call it on Pay Run approve when any line's project has `CertifiedPayroll = true`. Fail approve on violations.
- Stop using "first active WorkClassification". Use the line's WorkClassificationId.
- Compare against the resolved package/WD rate, not `Employee.BaseHourlyRate`.
- Include fringe: total rate = base + required fringe, consistent with `WageDeterminationRate.TotalRate`.

### 5.6 PDF

`PdfReportService.GenerateWh347PdfAsync` stays the writer but is fed persisted certified lines. Remove hardcoded 7.65% FICA and 12% withholding. Taxes on the form come from slip tax components when the tax pack exists (P2); until then those columns are blank or labeled "not calculated" — never a fake percent.

---

## 6. Tax

Overlay pack name: `us_tax`. P2 deliverable. Current score 0/5.

### 6.1 TaxTableVersion

Payroll tax content is a versioned import from a vendor. Pitbull stores which version ran on a Pay Run (`PayRun.TaxTableVersionId`) so a slip is reproducible. Pitbull does not author federal/state/local percentage rows.

Automatic updates = vendor API / file drop ingested into `TaxTableVersion`. Not a Hangfire scrape of IRS Pub 15-T. Not a human spreadsheet in the repo.

### 6.2 W-4 is an input

`EmployeeTaxCompliance` is already collected. P2 calc must read:

- `W4FilingStatus`, `W4AdditionalWithholding`, `W4Exempt`
- Residence state (new field on tax compliance or employee)
- SSN last four remains encrypted; full SSN never in payroll lines

Exempt -> no federal withholding; FICA still applies unless a documented exception (out of v1). Additional withholding adds to FIT.

### 6.3 Work-state vs residence-state

- Work state = `Project.State` on each PaySlipLine (hours can span states in one run).
- Residence state = employee tax compliance.
- Reciprocity / convenience-of-employer rules are vendor problems. The adapter is passed work-state, residence-state, wages by state, YTD, and W-4. Pitbull does not encode 50-state nexus itself.

If `Project.State` is empty on a line being taxed, the run cannot leave Processing.

### 6.4 Vendor feed (candidates)

Spike in P2. Pick one; do not integrate all four.

| Candidate | Role | Fit |
|-----------|------|-----|
| Symmetry | Tax engine / content | Common construction payroll tax content. |
| Vertex | Tax engine / content | Strong content; more enterprise. |
| Check | Embedded payroll / tax | Faster product if we want Check as SoR. |
| ADP / Paychex | Tax SoR via export + their calc | Matches existing `PayrollExportFormat` enum. We send wages; they are tax SoR. |

Adapter interface (logical): given slip earnings + employee tax profile + work/residence states + TaxTableVersion -> Pay Components for FIT, SIT, local, FICA EE/ER, FUTA, SUTA. Pitbull posts those components. Pitbull does not round-trip Pub 15-T.

Export-as-SoR path (ADP/Paychex): Pitbull may skip in-engine withholding and keep net as "not calculated here", but then WH-347 tax columns must come from the provider or stay labeled incomplete. That trade is the spike's job to recommend.

### 6.5 Explicitly out of scope for v1 engine

Building a 3,000-jurisdiction tax calculator in-house. Maintaining Pub 15-T. Using Billing sales-tax tables. Hardcoding 7.65% and 12% (those are bugs, not a tax engine).

Until P2 ships, `TotalNet = TotalGross` may remain in the database but UI and PDF must not call it a paycheck net.

---

## 7. GL posting + job cost

P3 deliverable. Current job-cost-to-payroll score 3/5: hours know the job; the run forgets; export invents the split.

### 7.1 Keep cost code on lines

`PaySlipLine` holds `ProjectId` + `CostCodeId` + hours + amount. Generation must not `GroupBy(employee)` as the only grain. Employee slip is a rollup of lines. Certified report is a rollup of lines for one project. Export can still emit employee-level files for ADP; job cost does not use that file as SoT.

Stop reallocating hours at export time.

### 7.2 Replace 35% burden

`LaborCostCalculator.DefaultBurdenRate = 0.35` is a proxy. P3 burden = sum of employer Pay Components (FICA ER, FUTA, SUTA, WC if we have it, union fringes) / base wages, computed from the slip, not a constant.

Until P3, keep the 35% calculator but label it proxy in any UI that shows burden. Comments that list FICA/FUTA/SUTA/WC as if computed are lies; delete that implication when the code is touched.

### 7.3 Post Payroll Taxes Payable

Chart already has the accounts. Use them. No new CoA required for v1 post.

| Account | Number | Payroll use |
|---------|--------|-------------|
| Direct Labor | 5000 | Debit gross wages (earnings that are labor). |
| Labor Burden & Benefits | 5100 | Debit employer fringes + employer taxes. |
| Accrued Payroll | 2100 | Credit net pay (until paid). |
| Payroll Taxes Payable | 2150 | Credit employee + employer payroll taxes withheld/accrued. |
| Cash - Payroll | 1010 | Later payment run (out of P3 if payment is separate). |

Post on Pay Run -> Posted (after Approved). One journal per run, lines split by project + cost code from PaySlipLine (job cost) and by tax vs wage vs fringe (GL). Idempotent: posting twice does not double; reverse + repost on correction.

WIP / job cost that today reads TimeEntry * BaseHourlyRate * 1.35 should, after P3, read posted PaySlipLine amounts. That change is in Billing/WIP, not a rewrite of Billing. Align with `docs/roadmap/financial-math-wip-arc.md` (cost-to-date is already too narrow); do not subsume that arc here.

---

## 8. Module split plan

No code in this spec. Map only. Follow `docs/ADDING-A-MODULE.md`: new classlib `Pitbull.Payroll`, marker registration, Dockerfile COPY, one EF context, services-first controllers.

### 8.1 What moves into Pitbull.Payroll

| From | What | Notes |
|------|------|-------|
| Pitbull.Billing | `PayrollRunService`, `CertifiedPayrollService`, `WageDeterminationService`, `PayrollExportService`, `PayrollReviewService`, `PrevailingWageValidationService` and their interfaces / feature contracts | Billing keeps AP/AR, WIP, vendors, *sales* tax. |
| Pitbull.Core | `PayrollRun`, `PayrollRunLine`, `CertifiedPayrollReport`, `WageDetermination`, `WageDeterminationRate`, `WorkClassification`, `PayrollRunReview`, `PayrollExport`, `PayrollExportLine`, `FringeBenefitAllocation` and `PayrollComplianceConfiguration` | Core stays shared kernel. These are not kernel. |
| Pitbull.Api | Controllers stay in Api host; they inject Payroll services. `PdfReportService.GenerateWh347PdfAsync` stays in Api/Reports writer but consumes Payroll DTOs. | Do not move the whole PDF service. |

New types in Payroll: PayComponent, PayStructure, UnionAgreement, WagePackage, TaxTableVersion, PaySlip, PaySlipLine, CertifiedPayrollLine, overlay pack registrars, `IWageRateResolver`, `IPayrollTaxProvider`.

### 8.2 What stays

| Module | Stays | Why |
|--------|-------|-----|
| TimeTracking | Employee, TimeEntry, PayPeriod, `LaborCostCalculator` (until P3), onboarding, `EmployeeUnionAffiliation`, `EmployeeTaxCompliance` | Hours and HR master data. Payroll takes a reference to TimeTracking. TimeTracking does **not** reference Payroll (no cycle). `WorkClassificationId` on TimeEntry is a Guid FK; Payroll owns the classification entity. |
| Billing | `TaxJurisdiction`, `TaxRate`, GL/journal services, WIP, vendors, POs | Sales tax and money SoT. Payroll *calls* journal post in P3. |
| Projects | Project, CostCode, Phase | `Project.State`, new `CertifiedPayroll` flag. |
| Core | BaseEntity, tenancy, permissions constants, `PitbullDbContext` assembly registration | Kernel. |
| Reports | Labor cost report query until it can read PaySlipLine | Avoid a Big Bang report rewrite in P0. |

### 8.3 API prefix

Keep `/api/payroll/*`. Do not introduce `/api/billing/payroll`. Frontend routes stay.

| Existing | Stays |
|----------|-------|
| `/api/payroll/runs` | Yes. Add validate-prevailing-wage; generate writes slips/lines. |
| `/api/payroll/certified` | Yes. Lines persisted. |
| `/api/payroll/wage-determinations` | Yes. |
| `/api/payroll/exports` | Yes. Format-specific writers are P2/P3; stop pretending Adp CSV is ADP. |
| `/api/payroll/reviews` | Yes. |

New prefixes (phase as in section 9): `/api/payroll/classifications`, `/api/payroll/agreements`, `/api/payroll/packages`, `/api/payroll/components`, `/api/payroll/structures`, `/api/payroll/tax-tables`.

### 8.4 Permissions

Keep: `Payroll.View`, `Payroll.Process`, `Payroll.CertifiedReport`, `Payroll.ViewRates`. Role `PayrollSpecialist` already maps `"Payroll."` plus Employees and time-tracking view/approve/rates.

Add (do not overload ViewRates):

| Permission | Use |
|------------|-----|
| `Payroll.ManageRates` | Work classifications, wage packages, WD rates. |
| `Payroll.ManageAgreements` | Union agreements. |
| `Payroll.PostGL` | Post run to journal (P3). Controller / CFO may hold this; Specialist may not. |

`Payroll.ViewRates` remains read of WD / packages. Writes need ManageRates.

---

## 9. Phased delivery

Each phase is independently shippable. Do not start P2 tax vendor work inside P0.

### P0 — Module split + union packages

**Intent:** Payroll is its own module. Union crews can be paid from a CBA package, not `BaseHourlyRate`.

Acceptance:

- [ ] `Pitbull.Payroll` classlib referenced by Api, registered (assembly + module services). Billing no longer contains payroll services or contracts.
- [ ] Payroll entities live in the Payroll module; Core `PayrollCompliance` types are gone or are type-forward only.
- [ ] WorkClassification CRUD under `/api/payroll/classifications`.
- [ ] UnionAgreement + WagePackage + date-effective rates CRUD. Overlay pack `union` registered as services, not `if` in the run service.
- [ ] `IWageRateResolver` implements job + CBA + class lookup (section 3.3 steps 1-2, 5).
- [ ] TimeEntry accepts `WorkClassificationId`. Pay slip / run line stores `WorkClassificationId` and `RateSource`.
- [ ] When a package matches, run money uses package rates. `BaseHourlyRate` is not read.
- [ ] When a union/certified row would fall back to `BaseHourlyRate`, generate fails with a typed error.
- [ ] `EmployeeUnionAffiliation` can point at UnionAgreement + WorkClassification + scale.
- [ ] Existing `/api/payroll/runs` generate still works for non-union private jobs (company default or fallback).
- [ ] Permissions unchanged plus `Payroll.ManageRates` and `Payroll.ManageAgreements`.
- [ ] No ERPNext/Odoo runtime. No tax vendor required. Net may still equal gross (labeled).

### P1 — True certified payroll

**Intent:** WH-347 is a stored report a payroll specialist can sign, not a PDF of guesses.

Acceptance:

- [ ] `Project.CertifiedPayroll` flag. Generate certified rejected when false.
- [ ] Certified lines persisted. GET returns stored lines. PDF reads stored lines.
- [ ] Line classification = WorkClassification, not Title/enum.
- [ ] Cash vs benefit fringe on the line from allocations / components.
- [ ] Statement of Compliance fields stored and required before submit.
- [ ] `POST /api/payroll/runs/{id}/validate-prevailing-wage` wired; approve on certified jobs calls it; first-active-class heuristic gone.
- [ ] Hardcoded 7.65% and 12% removed from the PDF path.
- [ ] WageDetermination still manual; seed CA DIR labeled as seed.

### P2 — Tax vendor spike + W-4 / multi-state

**Intent:** Choose a tax SoR. Use the W-4. Stop claiming net = gross.

Acceptance:

- [ ] Spike doc + adapter interface. One vendor chosen from Symmetry, Vertex, Check, ADP/Paychex. No in-house 3,000-jurisdiction engine.
- [ ] `TaxTableVersion` imported from vendor (or explicit "provider is SoR, no local tables" for ADP/Paychex path).
- [ ] Run calc reads W-4. Exempt / additional withholding honored.
- [ ] Work-state = `Project.State`; residence-state on employee tax record. Missing work-state blocks the run.
- [ ] `TotalNet` computed from components, not copied from gross, when the adapter ran.
- [ ] Overlay pack `us_tax` is a service. `PayrollRunService` does not contain `if (usa)` tax math.
- [ ] Automatic updates described as vendor ingest, not IRS scrape. No Pub 15-T in repo.
- [ ] Billing sales-tax tables untouched.

### P3 — GL + job cost

**Intent:** The pay line is the labor cost SoT.

Acceptance:

- [ ] PaySlipLine retains project + cost code through generate, export, and post. No hour reallocation at export.
- [ ] 35% burden constant not used for posted cost. Employer components replace it.
- [ ] Approved run can post: Dr 5000 / 5100, Cr 2100 / 2150, by job/cost code. Idempotent.
- [ ] `LaborCostCalculator` uses `IWageRateResolver` (or reads posted slips). Proxy label removed where real amounts exist.
- [ ] Export writers may still be generic CSV; job cost does not depend on them.

---

## 10. Open questions

1. Tax vendor winner after P2 spike: engine-in-process (Symmetry/Vertex) vs Check embed vs ADP/Paychex as SoR?
2. Does certified public work *without* a CBA still allow cash-in-lieu of fringe, or benefit-only per agency?
3. Multi-state in one slip: one FIT calculation on combined wages, or vendor-directed per work-state? Follow vendor, but confirm for CA/NY/IL crews.
4. Should `WorkClassification` stay company-scoped only, or also allow tenant-level catalogs shared across companies?
5. Travel/subsistence: time-entry fields in P0, or a later allowance document?
6. Certified e-file (LCPTracker, Elation, WHD XML) — export-only in v1, or a named P4?
7. WC (workers' comp) as a Pay Component in P3 burden, or still outside payroll?
8. Who holds `Payroll.PostGL` — Controller only, or PayrollSpecialist + Controller?

---

## 11. Mapping existing -> new

Implementers: names on the left are what is in the repo today (2026-09-02). Names on the right are this spec.

### Tables / entities

| Existing | Module today | New name / fate |
|----------|--------------|-----------------|
| `payroll_runs` / `PayrollRun` | Core | **PayRun**. Same table fine; add TaxTableVersionId, Posted status. |
| `payroll_run_lines` / `PayrollRunLine` | Core | **PaySlip** (employee rollup) + **PaySlipLine** (job/cost/class/component grain). Current line is too coarse to keep as the only grain. |
| `certified_payroll_reports` / `CertifiedPayrollReport` | Core | Keep. Add Statement of Compliance fields. |
| (none) | | **CertifiedPayrollLine** — persist what is now `CertifiedPayrollLineDto`. |
| `wage_determinations` / `WageDetermination` | Core | Keep. Public-work rate card. |
| `wage_determination_rates` / `WageDeterminationRate` | Core | Keep. Must be keyed by real WorkClassificationId. |
| `work_classifications` / `WorkClassification` | Core | Keep; add craft/class fields; dedicated CRUD. |
| `payroll_run_reviews` / `PayrollRunReview` | Core | Keep. |
| `payroll_exports` / `PayrollExport` | Core | Keep. Writers must match `PayrollExportFormat` or stop advertising Adp/Paychex/QuickBooks. |
| `payroll_export_lines` / `PayrollExportLine` | Core | Keep; fill WorkClassificationId; stop 20% deduction fake. |
| `fringe_benefit_allocations` / `FringeBenefitAllocation` | Core | Keep; add service/API; link to PaySlipLine. |
| `EmployeeUnionAffiliation` | TimeTracking | Keep; add UnionAgreementId, WorkClassificationId, ScaleCode. |
| `EmployeeTaxCompliance` | TimeTracking | Keep; W-4 used in P2; add residence state. |
| `Employee.BaseHourlyRate` | TimeTracking | Fallback only. Not the union/certified rate. |
| `Employee.Title` / `EmployeeClassification` | TimeTracking | Not WH-347 class. |
| `TimeEntry` | TimeTracking | Add WorkClassificationId, optional ShiftCode. Keep project/cost code/ST/OT/DT. |
| `PayPeriod` | TimeTracking | Stay. PayRun still points at it. |
| `TaxJurisdiction` / `TaxRate` | Billing | Stay. **Sales tax.** Do not reuse. |
| `Project.State` / `Project.Address` | Projects | Work-state. Add `CertifiedPayroll` bool. |
| Chart 1010 / 2100 / 2150 / 5000 / 5100 | Billing CoA | Stay. P3 posts here. |
| (none) | | **PayComponent**, **PayStructure**, **PayStructureLine**, **UnionAgreement**, **WagePackage**, **WagePackageRate**, **TaxTableVersion**. |

### APIs

| Existing | New |
|----------|-----|
| `GET/POST/PUT/DELETE /api/payroll/runs`, `POST .../generate`, `.../approve`, `.../export` | Same routes; generate uses resolver; approve calls PW validator when needed. |
| `GET/POST /api/payroll/certified`, `GET .../wh347-pdf` | Same; lines persisted; PDF from storage. |
| `CRUD /api/payroll/wage-determinations`, `GET .../lookup-rate` | Same; lookup-rate must use classification, not first-active. |
| `GET/POST /api/payroll/exports`, `GET .../download` | Same. |
| `GET/POST /api/payroll/reviews` | Same. |
| (none) | `POST /api/payroll/runs/{id}/validate-prevailing-wage` — expose `IPrevailingWageValidationService`. |
| (none) | `/api/payroll/classifications`, `/agreements`, `/packages`, `/components`, `/structures`, `/tax-tables`. |

### Services

| Existing | Fate |
|----------|------|
| `PayrollRunService` | Move to Payroll. Becomes orchestrator over resolver + packs. No USA tax `if`. |
| `CertifiedPayrollService` | Move. Persist lines. |
| `WageDeterminationService` | Move. |
| `PayrollExportService` | Move. Stop null classification and 20% deductions. |
| `PayrollReviewService` | Move. |
| `PrevailingWageValidationService` | Move. HTTP + approve hook. Classification from the line. |
| `PdfReportService.GenerateWh347PdfAsync` | Stay as writer. Consume persisted certified lines. Delete 0.0765 / 0.12. |
| `LaborCostCalculator` | Stay in TimeTracking until P3; then resolver or posted slips. |
| `ITaxJurisdictionService` | Stay in Billing. Unrelated. |

### UI / permissions (unchanged locations)

| Existing | Notes |
|----------|-------|
| `/payroll/runs`, `/certified`, `/wage-determinations`, `/reviews`, `/exports` | Keep. Add agreements/packages/classifications pages in P0. |
| `Payroll.View` / `Process` / `CertifiedReport` / `ViewRates` | Keep. Add ManageRates, ManageAgreements, PostGL. |
| Role `PayrollSpecialist` | Keep. `"Payroll."` prefix continues to cover new Payroll.* permissions except PostGL (grant explicitly). |

---

## 12. Implementation constraints (for the first PR that is not this spec)

- Spec only until a versioned implementation PR is opened. This file is not a license to dump C# into Billing.
- New module follows `docs/ADDING-A-MODULE.md` (net10.0 classlib, Dockerfile COPY, three Program.cs registrations, services-first).
- One EF context. No `RenameColumn` / `RenameTable` / `DROP TABLE` in migrations. Additive tables/columns; dual-write if PaySlip replaces PayrollRunLine in place.
- Overlay packs = registrations + data. If you need `if (jurisdiction == "US")` in `PayrollRunService`, the pack is wrong.
- Money `decimal(18,2)`, rates `decimal(18,4)`, UTC, tenant+company RLS, `!IsDeleted` on reads.
- Living architecture is `docs/ARCHITECTURE.md` + `src/Modules`. This spec becomes living truth for Payroll until code ships; then update ARCHITECTURE module table (14 -> 15) in the same PR that adds the csproj.