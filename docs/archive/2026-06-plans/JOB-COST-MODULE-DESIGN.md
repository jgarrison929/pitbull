# Job Cost Module — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.ProjectManagement` (job cost sub-module) + `Pitbull.Billing` (GL integration)
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-22
> **Sponsor:** Controller/CFO (Sarah Mathews), VP of Construction (Tom Reilly)
> **Executive Review Reference:** "Job cost is the nervous system of a GC. Every dollar spent must trace to a project, phase, and cost code. If job cost is wrong, WIP is wrong, billing is wrong, financials are wrong."
> **References:** `docs/plans/WIP-SCHEDULE-SPEC.md`, `docs/plans/SCHEDULE-MODULE-DESIGN.md`, `docs/roles/CONTROLLER-CFO.md`, `docs/roles/PROJECT-MANAGER.md`

---

## 0) Why This Module Exists

### Job Cost Is the Nervous System

Job costing is not a report. It is the real-time accounting of every dollar spent on every project, tracked to the granularity of cost code and phase. Every other construction financial function depends on it:

- **WIP Schedule** reads job cost actuals to calculate percent complete (cost-to-cost method)
- **Billing** compares earned revenue to costs to detect overbilling/underbilling
- **Forecasting** starts with actual costs and projects forward to estimate final cost
- **GL** receives cost postings from job cost transactions
- **Payroll** posts labor cost to jobs via approved timecards
- **AP** posts material and subcontract costs to jobs via invoices and pay apps
- **Bonding companies** review job cost reports to assess contractor capacity

If job cost is inaccurate, the entire financial reporting chain is corrupted. A WIP schedule built on bad job cost data produces misleading revenue recognition, which means the financial statements are wrong, which means the bonding company makes decisions on bad data, which means the contractor loses bonding capacity, which means they can't bid new work. The stakes are existential.

### What We Replace

| System | What It Does | Why It Falls Short |
|--------|-------------|-------------------|
| **Vista by Viewpoint** | Full construction accounting + job cost | $80K+ implementation, 12-month deploy, mainframe-era UX, requires dedicated admin |
| **Sage 300 CRE** | Job cost + GL + AP/AR | On-prem only, Windows desktop, no mobile, no real-time dashboards, $50K+ |
| **Procore** | Project management with basic cost tracking | Not a real cost system -- no GL, no WIP, no payroll integration, can't produce financial statements |
| **InEight** | Estimating + cost management | Best-in-class estimating but $100K+ enterprise licensing, no integrated GL |
| **Foundation Software** | Construction accounting | Solid job cost but dated UX, no API, no mobile, single-company only |

**Our advantage:** Job cost is not a separate module bolted on -- it lives inside the same system as timecards, POs, subcontracts, change orders, and GL. When a superintendent approves a timecard, the labor cost flows to the job automatically. When AP processes a vendor invoice matched to a PO, the material cost posts to the job. No batch imports, no reconciliation spreadsheets, no "where did that cost come from?"

---

## 1) Industry Context: How Job Costing Works in Construction

### 1.1 The Cost Code System (CSI MasterFormat)

Construction uses a standardized coding system to categorize work. The Construction Specifications Institute (CSI) MasterFormat organizes all construction work into 50 divisions:

| Division | Description | Examples |
|----------|-------------|---------|
| 01 | General Requirements | Mobilization, bonds, insurance, temp facilities |
| 02 | Existing Conditions | Demolition, hazmat abatement |
| 03 | Concrete | Foundations, slabs, structural concrete |
| 04 | Masonry | CMU walls, brick veneer |
| 05 | Metals | Structural steel, miscellaneous metals |
| 06 | Wood/Plastics/Composites | Framing, millwork, cabinets |
| 07 | Thermal/Moisture Protection | Roofing, insulation, waterproofing |
| 08 | Openings | Doors, windows, hardware |
| 09 | Finishes | Drywall, painting, flooring, tile, acoustical ceilings |
| 10-14 | Specialties through Conveying | Signage, food service, elevators |
| 21-28 | Fire Suppression through Electronic Safety | MEP systems |
| 31-35 | Earthwork through Waterway/Marine | Sitework |

Within each division, cost codes break down further. For example, Division 03 (Concrete):

```
03-100  Concrete Forming
03-200  Concrete Reinforcement
03-300  Cast-in-Place Concrete
03-350  Concrete Finishing
03-400  Precast Concrete
03-500  Cementitious Decks/Toppings
```

### 1.2 The Three-Part Job Cost Code

Most GCs use a three-part cost code structure:

```
[Project].[Phase].[Cost Code].[Cost Type]

Example: PRJ-2026-001.02.03-300.L
  PRJ-2026-001 = Project (Building A)
  02            = Phase (Structure)
  03-300        = Cost Code (Cast-in-Place Concrete)
  L             = Cost Type (Labor)
```

**Cost Types** (the five categories every GC tracks):

| Code | Type | Source |
|------|------|--------|
| L | Labor | Time entries → payroll → job cost |
| M | Material | Purchase orders → vendor invoices → job cost |
| S | Subcontract | Subcontract pay apps → job cost |
| E | Equipment | Equipment hours × rate → job cost |
| O | Other | Manual entries, misc costs |

### 1.3 The Job Cost Lifecycle

```
Estimate → Budget → Commitments → Actuals → Forecast → WIP → GL
```

1. **Estimate:** The bid establishes expected costs by cost code (before project starts)
2. **Budget:** When the project is awarded, the estimate becomes the budget (original budget)
3. **Commitments:** POs and subcontracts are committed costs -- money promised but not yet spent
4. **Actuals:** Costs actually incurred: labor (timecards), materials (invoices), subs (pay apps), equipment (usage logs)
5. **Forecast:** PM estimates cost-to-complete for each cost code, producing EAC (Estimated at Completion)
6. **WIP:** EAC feeds the WIP schedule for revenue recognition
7. **GL:** All transactions post to the general ledger for financial statements

### 1.4 The Critical Equation

```
Projected Final Cost = Actual to Date + Committed (not yet billed) + Cost to Complete

Where:
- Actual to Date = sum of all posted costs (labor + material + sub + equipment + other)
- Committed = approved POs + subcontracts - amounts already billed/paid
- Cost to Complete = PM's estimate of remaining costs not yet committed
```

This equation is evaluated **per cost code, per phase, per project** -- and then rolled up to project totals and company portfolio. A $200M GC might have 40 active projects × 50 cost codes × 5 phases = 10,000 budget lines being tracked simultaneously.

---

## 2) Existing Entity Model

The codebase already has job cost entities in `Pitbull.ProjectManagement.Domain`. These are the foundation:

### 2.1 Job Cost Entities (Already Built)

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| `PmJobCostBudget` | Budget line per project/cost code/phase | OriginalBudget, ApprovedBudgetChanges, CurrentBudget, BudgetUnits, UnitOfMeasure, BudgetUnitCost, LaborBurdenRate |
| `PmJobCostActual` | Actual cost transaction | AsOfDate, LaborCost, MaterialCost, EquipmentCost, SubcontractCost, OtherCost, TotalActualCost, SourceType (TimeEntries/PurchaseOrder/Subcontract/ManualAdjustment), SourceReferenceId |
| `PmJobCostCommitment` | Committed cost (POs + subs) | CommitmentType (Subcontract/PurchaseOrder/Other), ReferenceId, OriginalCommittedAmount, ApprovedChangesAmount, CurrentCommittedAmount, BilledToDate, PaidToDate, RemainingCommitted, Status |
| `PmJobCostForecast` | PM cost-to-complete estimate | ForecastPeriod, ActualToDate, CommittedToDate, CostToComplete, EstimatedFinalCost, VarianceToBudget, ForecastConfidence (Low/Medium/High), Notes |
| `PmJobCostUnitProgress` | Unit-based progress tracking | PeriodDate, InstalledQuantity, InstalledUnit, CumulativeQuantity, CumulativeCost, CostPerUnit |

All five entities are scoped by `CompanyId`, `ProjectId`, `CostCodeId`, and optional `PhaseId`.

### 2.2 Source Entities (Already Built)

These entities feed costs into the job cost system:

| Entity | Module | What It Contributes |
|--------|--------|-------------------|
| `TimeEntry` | TimeTracking | Labor cost: RegularHours, OvertimeHours, DoubletimeHours × pay rate → LaborCost per CostCodeId/PhaseId |
| `PurchaseOrder` + `PurchaseOrderLine` | Core | Material commitments: PO lines with CostCodeId, Quantity × UnitPrice = committed amount |
| `VendorInvoice` | Core | Material actuals: matched to PO, posts actual material cost |
| `Subcontract` | Contracts | Subcontract commitments: OriginalValue + change orders = CurrentValue |
| `PaymentApplication` | Contracts | Subcontract actuals: approved pay app amount posts as sub cost |
| `ChangeOrder` | Contracts | Budget changes: approved CO amount adjusts budget and commitment |
| `Equipment` | Core | Equipment cost: HourlyRate × hours from TimeEntry.EquipmentHours |
| `JournalEntry` + `JournalEntryLine` | Core | GL posting: JE lines carry ProjectId + CostCodeId for job cost dimension |
| `CostCode` | Core | Cost code master data: Code, Description, Division, CostType, hierarchy via ParentCostCodeId |
| `Phase` | Projects | Phase structure: Name, CostCode, BudgetAmount per project |
| `Project` + `ProjectBudget` | Projects | Project-level aggregates: ContractAmount, TotalBudget, TotalCommitted, TotalActualCost |

### 2.3 Related Financial Entities (Already Built)

| Entity | Module | Job Cost Relationship |
|--------|--------|----------------------|
| `WipReport` + `WipReportLine` | Core | Reads job cost actuals + EAC for WIP calculation |
| `CostPrediction` | Core | AI-predicted final cost per project |
| `ChartOfAccount` | Core | GL accounts that receive job cost postings |
| `AccountingPeriod` | Core | Period boundaries for cost posting |
| `BillingApplication` + `BillingApplicationLineItem` | Core | Owner billing (G702/G703), compared to earned value for over/under billing |
| `OwnerContract` + `OwnerScheduleOfValues` + `OwnerSOVLineItem` | Core | Owner-side contract and SOV lines mapped to cost codes |
| `PmEarnedValueSnapshot` | ProjectManagement | BCWS/BCWP/ACWP/SPI/CPI from schedule + job cost |

### 2.4 Enums (Already Defined)

```
CostType: Labor=1, Material=2, Equipment=3, Subcontract=4, Other=5, Overhead=6
JobCostSourceType: TimeEntries=0, PurchaseOrder=1, Subcontract=2, ManualAdjustment=3
CommitmentType: Subcontract=0, PurchaseOrder=1, Other=2
CommitmentStatus: Draft=0, Approved=1, PartiallyInvoiced=2, Closed=3
ForecastConfidenceLevel: Low=0, Medium=1, High=2
```

---

## 3) New Entities Required

### 3.1 `PmJobCostTransaction` — Unified Cost Ledger

The existing `PmJobCostActual` aggregates costs by period. But for audit trail and drill-through, we need individual transactions. This entity records every cost posting to a job:

```csharp
public class PmJobCostTransaction : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }

    // Transaction identity
    public string TransactionNumber { get; set; }      // Auto: "JCT-2026-000142"
    public DateOnly TransactionDate { get; set; }       // Cost posting date
    public DateOnly AccountingPeriodDate { get; set; }  // Determines GL period

    // Cost breakdown
    public CostType CostType { get; set; }              // Labor, Material, Sub, Equipment, Other
    public decimal Amount { get; set; }                  // Positive = cost, negative = credit/reversal
    public decimal? Units { get; set; }                  // Hours (labor), quantity (material), etc.
    public string? UnitOfMeasure { get; set; }           // "hours", "cubic yards", "each"
    public decimal? UnitCost { get; set; }               // Amount / Units

    // Source traceability
    public JobCostSourceType SourceType { get; set; }
    public Guid? SourceReferenceId { get; set; }         // FK to TimeEntry, VendorInvoice, PaymentApplication, etc.
    public string? SourceDescription { get; set; }       // "TimeEntry #4521 - John Smith - 8.0 hrs"
    public string? VendorName { get; set; }              // Denormalized for report readability

    // GL integration
    public Guid? JournalEntryLineId { get; set; }        // FK to JE line when posted to GL
    public bool IsPostedToGl { get; set; }

    // Status
    public JobCostTransactionStatus Status { get; set; } // Pending, Posted, Reversed
    public Guid? ReversalOfId { get; set; }              // FK to transaction being reversed
    public string? Description { get; set; }
}

public enum JobCostTransactionStatus { Pending = 0, Posted = 1, Reversed = 2 }
```

**Why this entity is needed:** `PmJobCostActual` stores aggregated period totals by category. That's useful for reporting but makes it impossible to answer "show me every cost posting to cost code 03-300 in January" with drill-through to the source document. The transaction ledger provides the audit trail that controllers and auditors require.

### 3.2 `PmJobCostBudgetTransfer` — Budget Reallocation

PMs frequently need to move budget between cost codes. For example, if concrete costs less than expected but rebar costs more, the PM transfers budget from 03-300 to 03-200. This must be tracked:

```csharp
public class PmJobCostBudgetTransfer : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }

    // Source
    public Guid FromCostCodeId { get; set; }
    public Guid? FromPhaseId { get; set; }

    // Destination
    public Guid ToCostCodeId { get; set; }
    public Guid? ToPhaseId { get; set; }

    // Amount
    public decimal Amount { get; set; }
    public string Reason { get; set; }

    // Approval
    public Guid RequestedByUserId { get; set; }
    public DateTime RequestedAt { get; set; }
    public BudgetTransferStatus Status { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApprovalNotes { get; set; }
}

public enum BudgetTransferStatus { Pending = 0, Approved = 1, Rejected = 2 }
```

**Key constraint:** Budget transfers are zero-sum. The total project budget does not change -- only the distribution across cost codes. Approved change orders are the only way to increase total project budget.

### 3.3 `PmProductivityMetric` — Labor Productivity Tracking

Construction productivity is measured in units per hour (or hours per unit). This is the single most important metric for labor-intensive trades:

```csharp
public class PmProductivityMetric : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid CostCodeId { get; set; }
    public Guid? PhaseId { get; set; }
    public DateTime PeriodDate { get; set; }

    // Production data
    public decimal InstalledQuantity { get; set; }       // Units installed this period
    public string InstalledUnit { get; set; }            // "linear feet", "square feet", "cubic yards"

    // Labor data
    public decimal LaborHours { get; set; }              // Total labor hours this period
    public decimal LaborCost { get; set; }               // Total labor cost this period

    // Productivity metrics (computed)
    public decimal UnitsPerHour { get; set; }            // InstalledQuantity / LaborHours
    public decimal HoursPerUnit { get; set; }            // LaborHours / InstalledQuantity
    public decimal CostPerUnit { get; set; }             // LaborCost / InstalledQuantity

    // Budget comparison
    public decimal? BudgetUnitsPerHour { get; set; }     // From PmJobCostBudget
    public decimal? BudgetCostPerUnit { get; set; }
    public decimal? ProductivityVariance { get; set; }   // Actual vs budget (%)
}
```

**Example:** Budget says concrete forming should take 0.15 hours per square foot of contact area. Actual is 0.19 hours per SF. Productivity variance = -26.7%. The PM now knows concrete forming is significantly less efficient than estimated and can investigate why (design complexity, crew experience, weather).

---

## 4) Cost Flow Architecture

### 4.1 How Costs Enter the Job Cost System

```
                    ┌─────────────────┐
                    │   Time Entry    │ ← Superintendent approves
                    │  (Labor Cost)   │
                    └────────┬────────┘
                             │ Hours × PayRate × BurdenRate
                             ▼
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  Vendor Invoice │──▶│  Job Cost        │◀──│  Sub Pay App     │
│ (Material Cost) │   │  Transaction     │   │ (Subcontract)    │
└─────────────────┘   │  Ledger          │   └──────────────────┘
                      └────────┬─────────┘
                               │                    ┌──────────────────┐
┌─────────────────┐            │                    │  Manual JE       │
│  Equipment Log  │────────────┘◀───────────────────│ (Adjustments)    │
│ (Equip Cost)    │                                 └──────────────────┘
└─────────────────┘
                      ┌────────┴─────────┐
                      │  PmJobCostActual │ ← Period aggregation
                      │  (Rollup)        │
                      └────────┬─────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
     │   WIP       │   │  Job Cost   │   │   GL         │
     │  Schedule   │   │  Reports    │   │ Subledger    │
     └─────────────┘   └─────────────┘   └──────────────┘
```

### 4.2 Labor Cost Flow

1. **Field entry:** Superintendent enters time for crew member → `TimeEntry` with ProjectId, CostCodeId, PhaseId, RegularHours, OvertimeHours, DoubletimeHours
2. **Approval:** Supervisor approves → Status = Approved
3. **Costing:** `IJobCostPostingService` calculates cost:
   ```
   LaborCost = (RegularHours × PayRate) + (OvertimeHours × PayRate × 1.5) + (DoubletimeHours × PayRate × 2.0)
   BurdenedCost = LaborCost × (1 + LaborBurdenRate)
   ```
   Burden rate covers: FICA, workers comp, health insurance, union dues, PTO accrual. Typically 30-55% of base labor cost.
4. **Posting:** Creates `PmJobCostTransaction` with CostType=Labor, SourceType=TimeEntries
5. **GL:** Debit Job Cost Labor (5100) / Credit Accrued Payroll (2200)

### 4.3 Material Cost Flow

1. **Commitment:** PM creates PurchaseOrder with lines → `PmJobCostCommitment` with CommitmentType=PurchaseOrder
2. **Invoice receipt:** AP receives vendor invoice, matches to PO → `VendorInvoice` + `InvoiceMatchResult`
3. **Approval:** PM approves invoice (or auto-approved if within tolerance)
4. **Posting:** Creates `PmJobCostTransaction` with CostType=Material, SourceType=PurchaseOrder
5. **Commitment update:** `PmJobCostCommitment.BilledToDate` += invoice amount, `RemainingCommitted` decreases
6. **GL:** Debit Job Cost Material (5200) / Credit Accounts Payable (2000)

### 4.4 Subcontract Cost Flow

1. **Commitment:** PM executes subcontract → `PmJobCostCommitment` with CommitmentType=Subcontract
2. **Pay app receipt:** Sub submits `PaymentApplication` for period work
3. **Approval:** PM reviews and approves pay app
4. **Posting:** Creates `PmJobCostTransaction` with CostType=Subcontract, SourceType=Subcontract
5. **Retainage:** Retainage portion (typically 10%) is held back and tracked separately
6. **GL:** Debit Job Cost Subcontract (5300) / Credit Accounts Payable (2000), Debit Retainage Held (2150) for retained portion

### 4.5 Equipment Cost Flow

1. **Usage:** TimeEntry records EquipmentId + EquipmentHours for equipment used on the job
2. **Costing:** `IJobCostPostingService` calculates: EquipmentHours × Equipment.HourlyRate
3. **Posting:** Creates `PmJobCostTransaction` with CostType=Equipment
4. **GL:** Debit Job Cost Equipment (5400) / Credit Equipment Clearing (1500)

### 4.6 Change Order Impact

When a change order is approved:
1. `PmJobCostBudget.ApprovedBudgetChanges` += CO amount for affected cost codes
2. `PmJobCostBudget.CurrentBudget` = OriginalBudget + ApprovedBudgetChanges
3. If CO is to a sub: `PmJobCostCommitment.ApprovedChangesAmount` += CO amount
4. `ProjectBudget.ApprovedChangeOrders` += CO amount at project level

---

## 5) Core Feature: Budget vs. Actual Tracking

### 5.1 The Job Cost Summary View

The job cost summary is the PM's primary financial dashboard. For each cost code line:

| Column | Source | Formula |
|--------|--------|---------|
| **Original Budget** | `PmJobCostBudget.OriginalBudget` | Set at project start from estimate |
| **Approved COs** | `PmJobCostBudget.ApprovedBudgetChanges` | Sum of approved change orders for this cost code |
| **Current Budget** | `PmJobCostBudget.CurrentBudget` | Original + COs |
| **Committed** | `PmJobCostCommitment.CurrentCommittedAmount` | POs + subs approved for this cost code |
| **Actual to Date** | `PmJobCostActual.TotalActualCost` | Sum of all posted costs |
| **Open Committed** | Committed - Billed to Date | Money promised but not yet invoiced |
| **Cost to Complete** | `PmJobCostForecast.CostToComplete` | PM's estimate of remaining work |
| **Projected Final** | `PmJobCostForecast.EstimatedFinalCost` | Actual + Open Committed + Cost to Complete |
| **Variance** | Current Budget - Projected Final | Positive = under budget, negative = over |
| **Variance %** | Variance / Current Budget × 100 | Quick health indicator |
| **% Complete** | Actual / Projected Final × 100 | Cost-based completion |

### 5.2 Variance Analysis Rules

| Variance | Color | Meaning | Action |
|----------|-------|---------|--------|
| > +10% | Green | Significantly under budget | Verify scope is complete; may indicate missed costs |
| +1% to +10% | Light green | On track, under budget | Normal |
| -1% to +1% | Gray | On budget | Normal |
| -1% to -5% | Yellow | Slightly over budget | PM should explain in forecast notes |
| -5% to -10% | Orange | Over budget | Controller review required |
| < -10% | Red | Significantly over budget | Executive escalation, recovery plan required |

### 5.3 Committed Cost Tracking

Committed costs represent the gap between what you've agreed to pay and what you've actually paid. This is critical because:

- A project can be "on budget" in actuals but wildly over budget when you include commitments
- Example: Budget = $500K for concrete. Actual to date = $200K. Looks fine. But committed (subcontract) = $450K. You're already $150K over budget before the sub finishes.

```
Projected Final = Actual + Open Committed + Cost to Complete

Where:
  Open Committed = Committed Amount - Billed/Paid Amount
  Cost to Complete = PM estimate for work not yet committed
```

### 5.4 Service Interface

```csharp
public interface IJobCostService
{
    // Budget operations
    Task<List<JobCostSummaryDto>> GetJobCostSummaryAsync(Guid projectId, CancellationToken ct);
    Task<JobCostSummaryDto> GetCostCodeDetailAsync(Guid projectId, Guid costCodeId, Guid? phaseId, CancellationToken ct);
    Task InitializeBudgetFromEstimateAsync(Guid projectId, List<BudgetLineDto> lines, CancellationToken ct);
    Task<PmJobCostBudgetTransfer> TransferBudgetAsync(Guid projectId, BudgetTransferCommand cmd, CancellationToken ct);

    // Actual cost posting
    Task PostLaborCostAsync(Guid timeEntryId, CancellationToken ct);
    Task PostMaterialCostAsync(Guid vendorInvoiceId, CancellationToken ct);
    Task PostSubcontractCostAsync(Guid paymentApplicationId, CancellationToken ct);
    Task PostEquipmentCostAsync(Guid timeEntryId, CancellationToken ct);
    Task PostManualCostAsync(ManualCostCommand cmd, CancellationToken ct);

    // Forecasting
    Task<PmJobCostForecast> UpdateForecastAsync(Guid projectId, Guid costCodeId, Guid? phaseId, ForecastUpdateCommand cmd, CancellationToken ct);
    Task<List<PmJobCostForecast>> GetForecastsAsync(Guid projectId, CancellationToken ct);

    // Transactions
    Task<List<PmJobCostTransaction>> GetTransactionsAsync(Guid projectId, TransactionFilterDto filter, CancellationToken ct);
    Task ReverseTransactionAsync(Guid transactionId, string reason, CancellationToken ct);
}
```

---

## 6) Core Feature: Cost-to-Complete Forecasting

### 6.1 Why Forecasting Is the PM's Most Important Job

Every month, the PM reviews every cost code and answers: "How much more will this cost to finish?" This is the **cost-to-complete (CTC)** estimate. Combined with actual costs and commitments, it produces the **EAC (Estimate at Completion)**.

The EAC feeds:
- WIP schedule (determines revenue recognition)
- Project profitability reports
- Bonding capacity calculations
- Executive portfolio dashboards

A PM who forecasts poorly creates cascading errors across the entire financial reporting chain. This is why controllers review PM forecasts before publishing WIP.

### 6.2 Forecasting Methods

| Method | When to Use | Formula |
|--------|------------|---------|
| **Manual CTC** | PM knows the remaining work | EAC = Actual + Open Committed + Manual CTC |
| **Trending** | System-generated from historical burn rate | EAC = Actual / % Complete (cost-to-cost) |
| **Remaining budget** | Accept original estimate for remaining work | EAC = Actual + (Current Budget - Actual) = Current Budget |
| **Committed + CTC** | When most remaining work is committed | EAC = Actual + Open Committed + Manual CTC for uncommitted |
| **Unit rate projection** | When production rates are reliable | EAC = (Total Units × Actual Cost per Unit) |

### 6.3 Forecast Workflow

1. **Auto-generate:** At period close, system generates forecast entries for all cost codes using trending method
2. **PM review:** PM opens forecast review page, sees system suggestion and actual data side by side
3. **PM override:** PM enters their CTC estimate with confidence level and notes explaining assumptions
4. **Controller review:** Controller reviews PM forecasts, may request revisions for unreasonable estimates
5. **Lock:** Once approved, forecast is locked for the period. WIP schedule uses the locked EAC.

### 6.4 Forecast Change Tracking

Every forecast change is versioned. The system tracks:
- Prior period EAC vs. current period EAC
- Who changed it and when
- Confidence level (Low/Medium/High)
- PM notes explaining the change

This creates an audit trail for the question: "Why did the EAC on cost code 03-300 increase by $80K between January and February?"

### 6.5 AI-Assisted Forecasting

The `CostPrediction` entity already exists with fields for PredictedFinalCost, ConfidenceLevel, PredictionMethod, and BurnRate. The AI forecast considers:

- **Burn rate trajectory:** Is cost accumulating faster than planned?
- **Productivity variance:** Are crews less productive than estimated?
- **Commitment gap:** How much of the budget is uncommitted (higher risk)?
- **Schedule variance:** If behind schedule, labor costs will likely increase
- **Historical patterns:** Similar cost codes on past projects -- what was the actual vs. budget ratio?

AI predictions are advisory. They surface as "system suggestion" in the forecast review page. The PM makes the final call.

---

## 7) Core Feature: Variance Analysis

### 7.1 Types of Variance

| Variance Type | Formula | What It Measures |
|---------------|---------|-----------------|
| **Budget Variance** | Current Budget - Projected Final | Will we finish within budget? |
| **Commitment Variance** | Current Budget - Committed | Is the remaining budget sufficient for uncommitted work? |
| **Actual Variance** | Budget to Date - Actual to Date | Are we spending faster than planned? (requires time-phased budget) |
| **Productivity Variance** | Budget Units/Hour - Actual Units/Hour | Are we efficient? |
| **Rate Variance** | Budget Cost/Unit - Actual Cost/Unit | Are we paying what we expected? |
| **Quantity Variance** | Budget Quantity - Actual Quantity | Are we using more material than planned? |

### 7.2 Variance Decomposition

For labor costs, variance can be decomposed into two components:

```
Total Labor Variance = Rate Variance + Efficiency Variance

Rate Variance = (Actual Rate - Budget Rate) × Actual Hours
  → "We paid more/less per hour than budgeted"

Efficiency Variance = (Actual Hours - Budget Hours) × Budget Rate
  → "We used more/fewer hours than budgeted"
```

**Example:**
- Budget: 1,000 hours × $45/hr = $45,000
- Actual: 1,150 hours × $48/hr = $55,200
- Rate Variance: ($48 - $45) × 1,150 = $3,450 unfavorable (paid more per hour)
- Efficiency Variance: (1,150 - 1,000) × $45 = $6,750 unfavorable (used more hours)
- Total Variance: $10,200 unfavorable = $3,450 + $6,750

### 7.3 Variance Alert Configuration

```csharp
public interface IVarianceAlertService
{
    /// Evaluates all cost codes for a project and returns threshold violations
    Task<List<VarianceAlert>> EvaluateProjectAsync(Guid projectId, CancellationToken ct);
}

public record VarianceAlert(
    Guid ProjectId,
    Guid CostCodeId,
    Guid? PhaseId,
    string CostCodeDescription,
    VarianceAlertSeverity Severity,       // Info, Warning, Critical
    string AlertType,                      // "BudgetOverrun", "CommitmentExceedsBudget", "ProductivityBelow", etc.
    decimal VarianceAmount,
    decimal VariancePercent,
    string Message
);
```

Configurable thresholds per company:
- **Budget variance warning:** -5% (default)
- **Budget variance critical:** -10% (default)
- **Commitment exceeds budget:** Any overage (always critical)
- **Productivity variance warning:** -15% (default)
- **Uncommitted budget alert:** > 20% of budget uncommitted past 50% complete (likely missing commitments)

---

## 8) Core Feature: GL Integration

### 8.1 GL Account Mapping

Job cost transactions must post to the correct GL accounts. The mapping is by cost type:

| Cost Type | Debit Account | Credit Account | Example |
|-----------|--------------|----------------|---------|
| Labor | Job Cost Labor (5100) | Accrued Payroll (2200) | Approved timecard posts labor cost |
| Material | Job Cost Material (5200) | Accounts Payable (2000) | Matched vendor invoice posts material cost |
| Subcontract | Job Cost Subcontract (5300) | Accounts Payable (2000) | Approved sub pay app posts sub cost |
| Equipment | Job Cost Equipment (5400) | Equipment Clearing (1500) | Equipment usage posts equipment cost |
| Other | Job Cost Other (5500) | Varies | Manual entry |

Each GL entry line carries `ProjectId` and `CostCodeId` as dimensional tags on `JournalEntryLine`, enabling GL reporting by job.

### 8.2 GL Posting Service

```csharp
public interface IJobCostGlPostingService
{
    /// Creates a journal entry for a batch of job cost transactions
    Task<JournalEntry> PostBatchAsync(List<Guid> transactionIds, CancellationToken ct);

    /// Previews the JE that would be created without actually posting
    Task<JournalEntryPreview> PreviewBatchAsync(List<Guid> transactionIds, CancellationToken ct);

    /// Reverses a previously posted batch
    Task<JournalEntry> ReverseBatchAsync(Guid originalJournalEntryId, string reason, CancellationToken ct);
}
```

### 8.3 Posting Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Real-time** | Each approved transaction immediately creates a JE | Small companies, simple GL |
| **Batch** | Transactions accumulate, controller posts a batch daily/weekly | Most companies, standard workflow |
| **Period-end** | All transactions post in one batch at period close | Strict period controls |

The `IsPostedToGl` flag on `PmJobCostTransaction` tracks whether each transaction has been posted. Unposted transactions appear in the "pending GL posting" queue for the controller.

### 8.4 Reconciliation

The controller must reconcile job cost to GL monthly:

```
Sum of all PmJobCostTransaction by CostType
  = Sum of JournalEntryLine amounts for job cost GL accounts (5100-5500)
  = Sum of PmJobCostActual.TotalActualCost across all projects
```

If these three numbers don't match, there's a posting error. The reconciliation report highlights discrepancies.

---

## 9) Core Feature: WIP Integration

### 9.1 How Job Cost Feeds WIP

The WIP schedule (see `docs/plans/WIP-SCHEDULE-SPEC.md`) needs these inputs from job cost for each project:

| WIP Input | Job Cost Source |
|-----------|----------------|
| Cost to Date | `SUM(PmJobCostActual.TotalActualCost)` for the project |
| Estimated Cost at Completion (EAC) | `SUM(PmJobCostForecast.EstimatedFinalCost)` across all cost codes |
| Committed Costs | `SUM(PmJobCostCommitment.RemainingCommitted)` for open commitments |
| Billings to Date | `SUM(BillingApplicationLineItem.TotalCompletedAndStored)` from AIA billing |

### 9.2 The WIP Equation (Cost-to-Cost Method)

```
Percent Complete = Cost to Date / EAC
Earned Revenue = Revised Contract Amount × Percent Complete
Over/Under Billing = Earned Revenue - Billings to Date

Where:
  Positive Over/Under = Underbilled (asset: costs and earnings in excess of billings)
  Negative Over/Under = Overbilled (liability: billings in excess of costs and earnings)
```

### 9.3 Job Cost → WIP Data Flow

```
PmJobCostActual  ─────┐
                       ├──▶  WipReportLine.TotalCostToDate
PmJobCostForecast ─────┤
                       ├──▶  WipReportLine.EstimatedTotalCost
PmJobCostCommitment ───┤
                       ├──▶  WipReportLine.EstimatedCostToComplete
BillingApplication ────┘
                       └──▶  WipReportLine.BilledToDate
```

### 9.4 EAC Validation Before WIP

Before generating a WIP snapshot, the system validates:
1. **Every active project has a current forecast.** Missing EAC → WIP cannot calculate % complete.
2. **EAC ≥ Actual to Date.** If EAC < Actual, the project is already over the estimate -- flag for review.
3. **No orphan costs.** All job cost transactions have a valid cost code mapping.
4. **Forecast is current period.** Stale forecasts (> 1 period old) produce a warning.

---

## 10) Core Feature: Productivity Analysis

### 10.1 Why Productivity Matters

Labor is typically 30-40% of a construction project's cost. A 10% improvement in labor productivity on a $50M project saves $1.5-2M. Productivity analysis answers:

- Are our crews as efficient as estimated?
- Which cost codes are underperforming?
- Are we improving or declining over time?
- How do we compare to industry benchmarks?

### 10.2 Productivity Metrics

| Metric | Formula | Example |
|--------|---------|---------|
| **Units per Hour** | Installed Quantity / Labor Hours | 2.5 SF of formwork per man-hour |
| **Hours per Unit** | Labor Hours / Installed Quantity | 0.4 hours per SF of formwork |
| **Cost per Unit** | Total Cost / Installed Quantity | $18.50 per SF of formwork |
| **Productivity Index** | Budget UPH / Actual UPH | > 1.0 = better than budget, < 1.0 = worse |
| **Earned Hours** | Installed Quantity × Budget Hours per Unit | Hours we "should have" used |
| **Productivity Variance** | Earned Hours - Actual Hours | Positive = efficient, negative = inefficient |

### 10.3 Productivity Service

```csharp
public interface IProductivityService
{
    /// Calculates productivity metrics for a cost code over a period
    Task<ProductivityReport> GetProductivityAsync(Guid projectId, Guid costCodeId, Guid? phaseId, DateRange period, CancellationToken ct);

    /// Gets productivity trend over time (weekly/monthly data points)
    Task<List<ProductivityTrendPoint>> GetTrendAsync(Guid projectId, Guid costCodeId, int periods, CancellationToken ct);

    /// Compares productivity across projects for the same cost code
    Task<List<ProjectProductivityComparison>> CompareAcrossProjectsAsync(Guid costCodeId, CancellationToken ct);
}
```

### 10.4 Productivity Data Sources

Productivity requires two data streams:
1. **Labor hours:** From `TimeEntry` (already exists, tracks hours by CostCodeId)
2. **Installed quantities:** From `PmJobCostUnitProgress` (already exists, tracks InstalledQuantity by CostCodeId)

The PM or superintendent enters installed quantities periodically (daily or weekly). The system combines this with approved labor hours to calculate productivity metrics.

---

## 11) Reports

### 11.1 Report Catalog

| Report | Audience | Purpose |
|--------|----------|---------|
| **Job Cost Summary** | PM, Controller | Budget vs. actual vs. forecast by cost code for one project |
| **Job Cost Detail** | PM, Auditor | Every transaction for a cost code with drill-through to source |
| **Cost Code Comparison** | PM, Estimator | Same cost code across multiple projects (benchmarking) |
| **Committed Cost Report** | PM, Controller | All open POs and subcontracts with remaining committed amounts |
| **Over/Under Billing** | Controller, CFO | Earned revenue vs. billings for all active projects |
| **Productivity Report** | PM, Superintendent | Units per hour, cost per unit, productivity index by cost code |
| **Forecast Variance** | Controller | EAC changes period-over-period with PM explanations |
| **Cost-to-Complete** | Bonding company | EAC summary for all active projects |
| **Budget Transfer Log** | Controller, Auditor | All budget reallocations with approvals |
| **GL Reconciliation** | Controller | Job cost vs. GL account balances |
| **Labor Cost Report** | PM, Payroll | Labor costs by project, employee, cost code, period |
| **Material Cost Report** | PM, AP | Material costs by project, vendor, PO, cost code |
| **Subcontract Status** | PM | Sub commitments, billings, retention, remaining by project |

### 11.2 Report Delivery

| Format | Use Case |
|--------|----------|
| **Screen** | Interactive dashboard with drill-through (primary) |
| **PDF** | Board-ready reports, bonding submissions, auditor packages |
| **XLSX** | Controller analysis, data manipulation, custom pivots |
| **CSV** | Export for external systems, data integration |

### 11.3 Key Report: Job Cost Summary Layout

```
Project: PRJ-2026-001 — Office Tower Phase II
Period: January 2026
Contract: $12,500,000  |  Budget: $10,750,000  |  % Complete: 42%

Cost Code     | Orig Budget |  Appr COs | Curr Budget | Committed | Actual   | Open Comm | CTC      | Proj Final | Variance | Var%
──────────────┼─────────────┼───────────┼─────────────┼───────────┼──────────┼───────────┼──────────┼────────────┼──────────┼──────
01-100 Mobil  |    180,000  |         0 |     180,000 |   165,000 |  158,200 |     6,800 |    8,000 |    173,000 |    7,000 |  3.9%
03-100 Forms  |    420,000  |    35,000 |     455,000 |   410,000 |  285,000 |   125,000 |   55,000 |    465,000 |  -10,000 | -2.2%
03-200 Rebar  |    380,000  |         0 |     380,000 |   350,000 |  198,000 |   152,000 |   45,000 |    395,000 |  -15,000 | -3.9%
03-300 Conc   |    650,000  |    45,000 |     695,000 |   680,000 |  410,000 |   270,000 |   30,000 |    710,000 |  -15,000 | -2.2%
05-100 Steel  |  1,200,000  |         0 |   1,200,000 | 1,150,000 |  920,000 |   230,000 |   35,000 | 1,185,000 |   15,000 |  1.3%
09-250 Dwall  |    340,000  |         0 |     340,000 |         0 |        0 |         0 |  340,000 |    340,000 |        0 |  0.0%
...           |             |           |             |           |          |           |          |            |          |
──────────────┼─────────────┼───────────┼─────────────┼───────────┼──────────┼───────────┼──────────┼────────────┼──────────┼──────
TOTAL         | 10,750,000  |   280,000 |  11,030,000 | 9,450,000 |6,200,000 | 3,250,000 |1,580,000 | 11,030,000 |        0 |  0.0%
```

---

## 12) API Design

### 12.1 Job Cost Summary & Budget

```
GET    /api/projects/{projectId}/job-cost/summary                           Full job cost summary
GET    /api/projects/{projectId}/job-cost/summary/{costCodeId}              Detail for one cost code
GET    /api/projects/{projectId}/job-cost/summary/{costCodeId}/{phaseId}    Detail for cost code + phase
POST   /api/projects/{projectId}/job-cost/budget/initialize                 Initialize budget from estimate
PUT    /api/projects/{projectId}/job-cost/budget/{budgetId}                 Update budget line
```

### 12.2 Budget Transfers

```
POST   /api/projects/{projectId}/job-cost/budget-transfers                  Request transfer
GET    /api/projects/{projectId}/job-cost/budget-transfers                  List transfers
PUT    /api/projects/{projectId}/job-cost/budget-transfers/{id}/approve     Approve transfer
PUT    /api/projects/{projectId}/job-cost/budget-transfers/{id}/reject      Reject transfer
```

### 12.3 Transactions

```
GET    /api/projects/{projectId}/job-cost/transactions                       List with filters
GET    /api/projects/{projectId}/job-cost/transactions/{id}                  Transaction detail
POST   /api/projects/{projectId}/job-cost/transactions/manual                Manual cost entry
POST   /api/projects/{projectId}/job-cost/transactions/{id}/reverse          Reverse a transaction
```

### 12.4 Commitments

```
GET    /api/projects/{projectId}/job-cost/commitments                        List all commitments
GET    /api/projects/{projectId}/job-cost/commitments/{id}                   Commitment detail
```

### 12.5 Forecasting

```
GET    /api/projects/{projectId}/job-cost/forecasts                          Current forecasts for all cost codes
PUT    /api/projects/{projectId}/job-cost/forecasts/{costCodeId}              Update forecast for cost code
POST   /api/projects/{projectId}/job-cost/forecasts/generate                 Auto-generate from trending
POST   /api/projects/{projectId}/job-cost/forecasts/lock                     Lock forecasts for period
```

### 12.6 Productivity

```
GET    /api/projects/{projectId}/job-cost/productivity                       Productivity metrics by cost code
GET    /api/projects/{projectId}/job-cost/productivity/{costCodeId}/trend     Trend over time
GET    /api/job-cost/productivity/compare?costCodeId={id}                     Cross-project comparison
```

### 12.7 Variance & Alerts

```
GET    /api/projects/{projectId}/job-cost/variance                           Variance analysis for all cost codes
GET    /api/projects/{projectId}/job-cost/alerts                             Active variance alerts
GET    /api/job-cost/alerts/portfolio                                         Alerts across all projects
```

### 12.8 Reports

```
GET    /api/projects/{projectId}/job-cost/reports/summary?format=pdf|xlsx|csv        Job cost summary report
GET    /api/projects/{projectId}/job-cost/reports/detail?costCodeId={id}&format=...   Cost code detail report
GET    /api/projects/{projectId}/job-cost/reports/committed?format=...                Committed cost report
GET    /api/projects/{projectId}/job-cost/reports/productivity?format=...             Productivity report
GET    /api/job-cost/reports/over-under-billing?format=...                            Over/under billing across projects
GET    /api/job-cost/reports/gl-reconciliation?periodId={id}&format=...               GL reconciliation
```

### 12.9 GL Posting

```
GET    /api/job-cost/gl/pending                                              Transactions pending GL posting
POST   /api/job-cost/gl/post                                                 Post batch to GL
GET    /api/job-cost/gl/post/{journalEntryId}/preview                        Preview JE before posting
POST   /api/job-cost/gl/post/{journalEntryId}/reverse                        Reverse a posted batch
```

---

## 13) Database Considerations

### 13.1 New Tables (Require Migration)

```sql
-- Unified cost transaction ledger
CREATE TABLE pm_job_cost_transactions (
    "Id" uuid PRIMARY KEY,
    "CompanyId" uuid NOT NULL,
    "ProjectId" uuid NOT NULL,
    "CostCodeId" uuid NOT NULL,
    "PhaseId" uuid,
    "TransactionNumber" varchar(50) NOT NULL,
    "TransactionDate" date NOT NULL,
    "AccountingPeriodDate" date NOT NULL,
    "CostType" varchar(20) NOT NULL,           -- string enum
    "Amount" numeric(18,2) NOT NULL,
    "Units" numeric(14,4),
    "UnitOfMeasure" varchar(50),
    "UnitCost" numeric(14,4),
    "SourceType" varchar(30) NOT NULL,         -- string enum
    "SourceReferenceId" uuid,
    "SourceDescription" varchar(500),
    "VendorName" varchar(200),
    "JournalEntryLineId" uuid,
    "IsPostedToGl" boolean NOT NULL DEFAULT false,
    "Status" varchar(20) NOT NULL,             -- string enum
    "ReversalOfId" uuid,
    "Description" varchar(1000),
    -- BaseEntity standard fields
    "TenantId" uuid NOT NULL,
    "CreatedAt" timestamptz NOT NULL,
    "CreatedBy" text NOT NULL,
    "UpdatedAt" timestamptz,
    "UpdatedBy" text,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "DeletedAt" timestamptz,
    "DeletedBy" text,
    "xmin" xid NOT NULL
);

-- Budget transfer tracking
CREATE TABLE pm_job_cost_budget_transfers (
    "Id" uuid PRIMARY KEY,
    "CompanyId" uuid NOT NULL,
    "ProjectId" uuid NOT NULL,
    "FromCostCodeId" uuid NOT NULL,
    "FromPhaseId" uuid,
    "ToCostCodeId" uuid NOT NULL,
    "ToPhaseId" uuid,
    "Amount" numeric(18,2) NOT NULL,
    "Reason" varchar(1000) NOT NULL,
    "RequestedByUserId" uuid NOT NULL,
    "RequestedAt" timestamptz NOT NULL,
    "Status" varchar(20) NOT NULL,
    "ApprovedByUserId" uuid,
    "ApprovedAt" timestamptz,
    "ApprovalNotes" varchar(1000),
    -- BaseEntity standard fields...
    "TenantId" uuid NOT NULL,
    "xmin" xid NOT NULL
);

-- Productivity metrics
CREATE TABLE pm_productivity_metrics (
    "Id" uuid PRIMARY KEY,
    "CompanyId" uuid NOT NULL,
    "ProjectId" uuid NOT NULL,
    "CostCodeId" uuid NOT NULL,
    "PhaseId" uuid,
    "PeriodDate" timestamptz NOT NULL,
    "InstalledQuantity" numeric(14,4) NOT NULL,
    "InstalledUnit" varchar(50) NOT NULL,
    "LaborHours" numeric(14,4) NOT NULL,
    "LaborCost" numeric(18,2) NOT NULL,
    "UnitsPerHour" numeric(14,4) NOT NULL,
    "HoursPerUnit" numeric(14,4) NOT NULL,
    "CostPerUnit" numeric(14,4) NOT NULL,
    "BudgetUnitsPerHour" numeric(14,4),
    "BudgetCostPerUnit" numeric(14,4),
    "ProductivityVariance" numeric(8,4),
    -- BaseEntity standard fields...
    "TenantId" uuid NOT NULL,
    "xmin" xid NOT NULL
);
```

### 13.2 Key Indexes

```sql
-- Transaction lookup by project (most common query)
CREATE INDEX IX_pm_jc_transactions_project ON pm_job_cost_transactions ("TenantId", "CompanyId", "ProjectId");

-- Transaction lookup by cost code (drill-through)
CREATE INDEX IX_pm_jc_transactions_costcode ON pm_job_cost_transactions ("TenantId", "CompanyId", "ProjectId", "CostCodeId");

-- Pending GL posting queue
CREATE INDEX IX_pm_jc_transactions_gl_pending ON pm_job_cost_transactions ("TenantId", "IsPostedToGl") WHERE "IsPostedToGl" = false AND "Status" = 'Posted';

-- Transaction by source (find all costs from a specific PO/invoice)
CREATE INDEX IX_pm_jc_transactions_source ON pm_job_cost_transactions ("SourceType", "SourceReferenceId");

-- Period-based transaction queries
CREATE INDEX IX_pm_jc_transactions_period ON pm_job_cost_transactions ("TenantId", "CompanyId", "AccountingPeriodDate");

-- Budget transfers by project
CREATE INDEX IX_pm_jc_budget_transfers_project ON pm_job_cost_budget_transfers ("TenantId", "CompanyId", "ProjectId");

-- Productivity by project + cost code + period
CREATE INDEX IX_pm_productivity_metrics ON pm_productivity_metrics ("TenantId", "CompanyId", "ProjectId", "CostCodeId", "PeriodDate" DESC);

-- Existing table indexes to verify/add:
CREATE INDEX IX_pm_job_cost_budgets_project ON pm_job_cost_budgets ("TenantId", "CompanyId", "ProjectId");
CREATE INDEX IX_pm_job_cost_actuals_project ON pm_job_cost_actuals ("TenantId", "CompanyId", "ProjectId", "AsOfDate" DESC);
CREATE INDEX IX_pm_job_cost_commitments_project ON pm_job_cost_commitments ("TenantId", "CompanyId", "ProjectId");
CREATE INDEX IX_pm_job_cost_forecasts_project ON pm_job_cost_forecasts ("TenantId", "CompanyId", "ProjectId", "ForecastPeriod" DESC);
```

### 13.3 Query Patterns

| Query | Expected Volume | Strategy |
|-------|----------------|----------|
| Job cost summary (all cost codes for one project) | 30-100 rows | Aggregate query with GROUP BY CostCodeId |
| Transaction list (one cost code, one month) | 20-200 rows | Indexed filter, paginated |
| Commitment status (all open for one project) | 10-50 rows | Filter by Status != Closed |
| Forecast review (all cost codes for one project) | 30-100 rows | Simple indexed query |
| GL posting queue (all unposted) | 50-500 rows | Index on IsPostedToGl WHERE false |
| Productivity trend (one cost code, 12 months) | 12-52 rows | Indexed by PeriodDate DESC |
| Portfolio alerts (all projects) | 200-2,000 rows | Background job, cached results |

---

## 14) Frontend Pages

### 14.1 Page Map

| Page | Route | Purpose |
|------|-------|---------|
| Job Cost Dashboard | `/projects/{id}/job-cost` | Summary view with KPI cards + cost code table |
| Cost Code Detail | `/projects/{id}/job-cost/{costCodeId}` | Transactions, productivity, trend for one cost code |
| Budget Setup | `/projects/{id}/job-cost/budget` | Initialize or modify budget lines |
| Budget Transfers | `/projects/{id}/job-cost/budget/transfers` | Request and approve budget reallocations |
| Forecast Review | `/projects/{id}/job-cost/forecast` | Monthly forecast review and update |
| Commitments | `/projects/{id}/job-cost/commitments` | All open POs and subcontracts |
| Transactions | `/projects/{id}/job-cost/transactions` | Full transaction ledger with filters |
| Productivity | `/projects/{id}/job-cost/productivity` | Productivity metrics and trends |
| GL Posting | `/admin/job-cost/gl-posting` | Controller: pending transactions for GL posting |
| Portfolio View | `/job-cost/portfolio` | Cross-project job cost overview |

### 14.2 Job Cost Dashboard (Primary Page)

**KPI Cards (top row):**
- Contract Amount (with CO adjustment)
- Total Budget (Original + COs)
- Actual to Date (with % of budget)
- Projected Final Cost (EAC)
- Projected Profit/Loss (Contract - EAC)
- Overall Variance (Budget - EAC, with trend arrow)

**Cost Code Table (main area):**
- Columns: Cost Code, Description, Original Budget, COs, Current Budget, Committed, Actual, Open Committed, CTC, Projected Final, Variance, Variance %
- Row colors: green (under budget), yellow (watch), red (over budget)
- Expandable rows: click to show phase-level breakdown
- Click-through: cost code → Cost Code Detail page

**Charts (right sidebar or bottom):**
- Budget vs. Actual bar chart by cost type (Labor/Material/Sub/Equip/Other)
- Cost trend line chart (monthly actuals vs. budget burn-down)
- Commitment pie chart (committed vs. remaining budget)

### 14.3 Forecast Review Page

Split-panel layout:

**Left panel:** Cost code list with current forecast status
- Icon: check (forecasted), warning (stale), empty (no forecast)
- Quick-entry: CTC, confidence, notes inline

**Right panel:** Detail for selected cost code
- Historical cost chart (actual vs. budget vs. forecast)
- System suggestion (AI/trending forecast)
- PM entry fields: CTC, confidence level, notes
- Variance explanation (required when variance > threshold)

**Bottom bar:** Lock forecast for period (controller only)

### 14.4 Portfolio View

Dashboard for the executive/controller showing all active projects:

**Table columns:** Project Name, Contract, Budget, Actual, Committed, EAC, Projected Profit, Margin %, Variance, Status
**Sorting:** By variance (worst first) or by contract size
**Drill-through:** Click project → Job Cost Dashboard for that project
**Alerts panel:** Top variance alerts across portfolio

---

## 15) Competitive Differentiation

### 15.1 vs. Vista by Viewpoint

| Capability | Vista | Pitbull |
|-----------|-------|---------|
| **Job cost accuracy** | Industry standard, trusted | Same data model, same granularity |
| **Price** | $80K+ implementation, $20K+/year maintenance | Included in ERP subscription |
| **Deployment** | 12-month implementation, dedicated admin | Web-based, self-serve |
| **Mobile** | Viewpoint Field View (separate product, extra cost) | Responsive web, same app |
| **Real-time data** | Batch imports from field systems | Live -- approved timecard posts in seconds |
| **WIP integration** | Manual data entry into WIP spreadsheet | Automatic -- job cost feeds WIP directly |
| **Billing integration** | Separate module, manual reconciliation | Same system -- SOV lines mapped to cost codes |
| **Schedule integration** | None (separate P6 or MS Project) | EV calculated from schedule + cost data |
| **AI forecasting** | None | Predictive EAC with confidence levels |
| **UX** | 1990s desktop application | Modern web, dark mode, keyboard shortcuts |

### 15.2 vs. Sage 300 CRE

| Capability | Sage 300 | Pitbull |
|-----------|----------|---------|
| **Multi-company** | Separate databases per company | Multi-tenant, multi-company, single login |
| **Cloud** | On-prem only (Sage Intacct is cloud but different product) | Cloud-native |
| **API** | COM/ODBC (legacy) | REST API, real-time webhooks |
| **Cost code hierarchy** | Limited to 3 levels | Unlimited hierarchy via ParentCostCodeId |
| **Forecasting** | Manual only | AI-assisted with trending and historical analysis |
| **Productivity** | Separate InEight integration | Built-in unit progress and productivity tracking |

### 15.3 vs. Procore

| Capability | Procore | Pitbull |
|-----------|---------|---------|
| **Job costing** | Budget tracking only, no real cost system | Full job cost ledger with GL integration |
| **GL** | No GL -- export to QuickBooks/Sage | Built-in double-entry GL |
| **WIP** | No WIP -- manual spreadsheet | Automated WIP from job cost data |
| **Payroll integration** | No payroll | Timecard → approval → payroll → job cost, one system |
| **Financial statements** | Cannot produce | Full financial reporting |
| **Cost type breakdown** | Basic categories | L/M/S/E/O with burden rate tracking |
| **Forecasting** | No EAC/CTC | Full forecast workflow with AI |

### 15.4 The Killer Advantage

**Procore's users** must export cost data to Vista/Sage for real accounting. **Vista/Sage users** must manually enter field data or buy separate field systems. **InEight users** pay $100K+ for estimating and cost management that doesn't include GL.

Pitbull eliminates every integration seam:
- Timecard approved → labor cost posts to job → GL updated → WIP calculated → billing reflects earned value
- PO created → commitment recorded → invoice matched → material cost posts → budget variance updates
- Sub pay app approved → sub cost posts → retention tracked → GL updated → WIP reflects new actual

No exports. No imports. No reconciliation spreadsheets. One source of truth.

---

## 16) Implementation Phases

### Phase 1: Foundation

1. `PmJobCostTransaction` entity + EF configuration + migration
2. `PmJobCostBudgetTransfer` entity + EF configuration + migration
3. `IJobCostService` — budget CRUD, manual cost posting, transaction queries
4. `IJobCostPostingService` — labor cost posting from approved timecards
5. Job Cost Summary endpoint (aggregated view)
6. Transaction list endpoint with filters
7. Frontend: Job Cost Dashboard, Budget Setup, Transactions pages
8. Unit tests: budget operations, cost posting, summary calculations

### Phase 2: Cost Integration

1. Material cost posting from matched vendor invoices
2. Subcontract cost posting from approved pay apps
3. Equipment cost posting from time entries
4. Commitment tracking (auto-create from POs and subcontracts)
5. Budget transfer workflow (request → approve)
6. Frontend: Commitments page, Budget Transfers page
7. Integration tests: end-to-end cost flow from source to job cost

### Phase 3: Forecasting & Analysis

1. `IForecastService` — manual CTC entry, trending auto-generation
2. `PmProductivityMetric` entity + productivity calculations
3. Variance analysis service with configurable alert thresholds
4. AI-assisted forecasting (leveraging `CostPrediction` entity)
5. Frontend: Forecast Review page, Productivity page
6. Reports: Job Cost Summary PDF/XLSX, Productivity Report

### Phase 4: GL & WIP Integration

1. `IJobCostGlPostingService` — batch GL posting from transactions
2. GL reconciliation report
3. WIP data feed (job cost → WipReportLine)
4. Portfolio view across all projects
5. Frontend: GL Posting page, Portfolio View
6. Over/under billing report
7. Bonding company report package

---

## 17) Acceptance Criteria

1. PM can initialize a project budget with 50+ cost code lines from an estimate
2. Approved timecard creates a `PmJobCostTransaction` with correct labor cost (hours × rate × burden)
3. Job cost summary correctly calculates: Original Budget + COs = Current Budget, and Actual + Open Committed + CTC = Projected Final
4. Budget transfer between cost codes is zero-sum (total project budget unchanged)
5. Committed costs from POs and subcontracts are tracked with remaining amounts updating as invoices/pay apps are processed
6. PM can enter cost-to-complete forecasts per cost code with confidence level and notes
7. Variance analysis flags cost codes exceeding configurable thresholds (default -5% warning, -10% critical)
8. Job cost transactions post to GL with correct account mapping (5100 Labor, 5200 Material, 5300 Sub, 5400 Equipment, 5500 Other)
9. GL reconciliation shows job cost total = GL account total = actuals aggregate
10. Job cost data flows correctly to WIP: CostToDate, EAC, CommittedCosts are accurate
11. Productivity metrics calculate correct units/hour and cost/unit from time entries and unit progress
12. All reports export to PDF, XLSX, CSV
13. Transaction drill-through links to source document (timecard, invoice, pay app)

---

## 18) Open Decisions

1. **Labor burden rate scope:** Per employee (accurate but complex), per cost code (simpler), or per project (simplest)? Currently on `PmJobCostBudget.LaborBurdenRate` -- per cost code per project.
2. **Transaction posting frequency:** Real-time on approval, daily batch, or period-end batch? Recommendation: real-time for labor (timecards approved daily), batch for AP (invoices processed in batches).
3. **Cost code template library:** Should we ship a default CSI MasterFormat template that companies can customize, or start with blank cost codes?
4. **Forecast lock granularity:** Lock all cost codes for a project at once, or allow per-cost-code locking?
5. **Equipment cost method:** Internal rate × hours (current model) or actual ownership cost allocation? Most mid-market GCs use internal rates.
6. **Cross-project cost codes:** Should cost code definitions be company-wide or per-project? Currently company-wide (`CostCode.IsCompanyStandard`), which is correct -- but projects may need project-specific additions.

---

*Addresses Executive Review concerns: CFO needs reliable job cost for WIP and financial statements. VP of Construction needs real-time cost visibility for decision-making. Estimating needs historical cost data for future bids.*
*References existing specs: `docs/plans/WIP-SCHEDULE-SPEC.md` for WIP integration, `docs/plans/SCHEDULE-MODULE-DESIGN.md` for earned value integration.*
