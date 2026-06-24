# Project Manager — Functional Role Reference

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## 1. Role Description

The Project Manager (PM) is the **revenue engine** of a construction company. They own the projects that generate all income. Every dollar of revenue starts with a PM managing a contract, and every dollar of cost flows through their cost tracking. The PM lives at the intersection of:

- **The owner/client** — who pays the bills and demands quality, schedule, and budget compliance
- **The field** — superintendents and crews who do the physical work
- **The office** — accounting, HR, and payroll who support the financial operations
- **Subcontractors** — who perform 60-80% of the work on most commercial projects

A construction PM is fundamentally different from a software PM. They manage physical assets, weather delays, union labor rules, material supply chains, government inspections, and contracts worth millions of dollars with liquidated damages for late delivery. The PM must be simultaneously a financial analyst, a diplomat, a schedule optimizer, and a risk manager.

### Why This Role Matters to Pitbull

The PM touches more modules than any other role. They create projects, assign cost codes, approve timecards, manage change orders, track costs, create billings, coordinate subcontractors, and produce the data that drives every financial report. **If the PM can't use the system efficiently, the company can't operate.**

---

## 2. Core Responsibilities

| Area | Description |
|------|-------------|
| **Project Setup** | Create the project record, define the schedule of values (SOV), establish the budget by cost code, set up phases/areas, assign team. |
| **Budget Management** | Original budget, approved change orders, revised budget, forecast at completion. The PM must know at all times: what will this project cost when it's done? |
| **Cost Tracking** | Monitor all costs against budget: labor (from timecards), materials (from POs/invoices), subcontractor costs (from pay apps), equipment, and other costs. |
| **Revenue Management** | Create monthly payment applications (billings) to the owner. In construction: progress billing against the schedule of values, usually in AIA format (G702/G703). |
| **Change Order Management** | Track proposed changes, price them, negotiate with the owner, get approval, update contract and budget. Change orders are where profit is made or lost. |
| **Subcontractor Management** | Issue subcontracts, track subcontractor progress, review and approve sub pay applications, manage retention, ensure insurance compliance. |
| **RFI Management** | Requests for Information — when the drawings are unclear, the PM submits RFIs to the architect and tracks responses. |
| **Submittal Management** | Product data, shop drawings, and samples that must be approved by the architect before materials are ordered or installed. |
| **Daily Reports** | Field conditions, manpower, work completed, safety incidents, weather, delays. These are legal documents in disputes. |
| **Schedule Management** | CPM schedule maintenance, look-ahead schedules, milestone tracking, delay analysis. |
| **Timecard Approval** | Review and approve field timecards. Ensure correct job, phase, and cost code allocation. This is the data that drives both payroll and job cost. |
| **Forecasting** | Estimate cost to complete (CTC) and estimated final cost (EAC) for each cost code. This feeds the WIP schedule. |
| **Meeting Management** | OAC (Owner/Architect/Contractor) meetings, subcontractor coordination meetings, internal project reviews. |

---

## 3. Data Owned (Entities / Tables)

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `Project` (Job) | Master project record | ProjectId, ProjectNumber, Name, ClientId, ContractType (Lump Sum/T&M/GMP/Cost Plus), OriginalContractAmount, Status (Bid/Active/Complete/Closed), StartDate, EstCompletionDate, Address, Superintendent, PM |
| `ScheduleOfValues` (SOV) | Billing line items | ProjectId, LineNumber, Description, ScheduledValue (original amount), ChangeOrderAmount, TotalScheduledValue |
| `CostCode` | Cost tracking structure | ProjectId, CostCodeId, PhaseCode, CostType (Labor/Material/Sub/Equipment/Other), Description, BudgetAmount, RevisedBudget |
| `Budget` | Budget lines | ProjectId, CostCodeId, OriginalBudget, ApprovedChanges, RevisedBudget, CommittedCost, CostToDate, EstimateToComplete, EstimateAtCompletion, Variance |
| `ChangeOrder` | Owner change orders | ProjectId, CONumber, Description, Status (Pending/Approved/Rejected/Void), ProposedAmount, ApprovedAmount, ApprovedDate, OwnerCONumber |
| `ChangeOrderDetail` | CO cost detail by cost code | ChangeOrderId, CostCodeId, Amount, Description |
| `PaymentApplication` | Monthly billing to owner | ProjectId, AppNumber, PeriodThrough, BillingDate, OriginalContract, ChangeOrders, ContractToDate, WorkCompletedPrior, WorkCompletedThisPeriod, MaterialsStored, TotalCompleted, RetainageAmount, TotalEarned, LessPreviousCerts, CurrentDue, BalanceToFinish |
| `PayAppDetail` | SOV billing detail (G703) | PaymentAppId, SOVLineId, ScheduledValue, PreviousCompleted, ThisPeriod, MaterialsStored, TotalCompleted, PercentComplete, BalanceToFinish, Retainage |
| `Subcontract` | Subcontractor agreements | ProjectId, SubcontractId, VendorId, TradeDescription, OriginalAmount, ChangeOrders, RevisedAmount, RetentionPercent, InsuranceExpDate, Status |
| `SubPayApp` | Subcontractor payment applications | SubcontractId, AppNumber, PeriodThrough, WorkCompletedThisPeriod, MaterialsStored, TotalCompleted, Retainage, AmountDue |
| `RFI` | Requests for Information | ProjectId, RFINumber, Subject, Question, SubmittedDate, DueDate, ResponseDate, Status, CostImpact, ScheduleImpact, AssignedTo |
| `Submittal` | Submittal tracking | ProjectId, SubmittalNumber, SpecSection, Description, SubmittedDate, DueDate, Status (Pending/Approved/ReviseResubmit/Rejected), SubcontractorId |
| `DailyReport` | Field daily reports | ProjectId, ReportDate, Weather, Temperature, Manpower (JSON), WorkPerformed, SafetyIncidents, Visitors, MaterialsReceived, EquipmentOnSite, DelayDescription |
| `ProjectCost` | Aggregated cost transactions | ProjectId, CostCodeId, TransactionType (Labor/AP/Commitment/JE), Amount, SourceModule, SourceDocId, TransactionDate |
| `PurchaseOrder` | Material/equipment purchase orders | ProjectId, PONumber, VendorId, Description, Amount, Status, CostCodeId |
| `Timecard` | Labor time records | EmployeeId, ProjectId, Date, CostCodeId, RegularHours, OTHours, DTHours, PerDiem, ApprovedBy, ApprovedDate, Status |
| `CostForecast` | PM cost-to-complete estimates | ProjectId, CostCodeId, ForecastDate, EstimateToComplete, EstimateAtCompletion, Notes, EstimatedBy |

---

## 4. Modules Used Daily

| Module | Usage |
|--------|-------|
| **Project Management** | Primary workspace. Project setup, status, SOV, change orders. |
| **Job Cost** | Cost tracking, budget vs. actual, forecast, cost code management. |
| **Billing / AR** | Create payment applications (G702/G703), track billing status. |
| **Subcontract Management** | Subcontract setup, pay app processing, compliance tracking. |
| **Timecard Management** | Review and approve field timecards. |
| **Document Management** | RFIs, submittals, daily reports, drawings, specs. |
| **Purchasing** | Purchase orders, material tracking. |
| **Change Order Management** | PCOs (potential change orders), CORs (change order requests), approved COs. |
| **Scheduling** | Milestone tracking, look-ahead schedules (often external tool integration). |
| **Reporting** | Job cost reports, project status, WIP input, productivity analysis. |

---

## 5. Dependencies on Other Roles

| Role | Dependency |
|------|-----------|
| **HR Director** | HR provides the employees that the PM assigns to projects. PM needs to know: who's available, what are their certifications, what's their pay rate (for cost projections). |
| **Payroll Manager** | PM approves timecards → Payroll processes them. Payroll posts labor costs back to jobs. If PM approves late, Payroll can't process on time. |
| **AP Clerk** | AP processes vendor invoices coded to the PM's projects. PM may need to approve invoices. AP processes subcontractor pay apps that the PM has approved. |
| **AR Clerk** | PM creates the billing (payment application). AR sends it to the owner, tracks payment, and posts cash receipts. |
| **Controller/CFO** | Controller uses PM's cost-to-complete estimates for the WIP schedule. PM's forecasting accuracy directly determines the quality of financial statements. |
| **System Admin** | Project setup configuration, cost code templates, user access. |

---

## 6. Workflows

### Project Lifecycle

```
1. BID/ESTIMATE
│  └── Estimator creates takeoff and bid → awarded → becomes a project
│
2. PROJECT SETUP
│  ├── Create Project record (contract type, amounts, dates, team)
│  ├── Build Schedule of Values (billing structure)
│  ├── Build Cost Code structure (cost tracking)
│  ├── Enter original budget by cost code
│  ├── Issue subcontracts
│  ├── Set up purchase orders
│  ├── Assign field staff
│  └── Establish project filing (RFI log, submittal log)
│
3. ACTIVE CONSTRUCTION
│  ├── Daily: Field reports, timecard submission
│  ├── Weekly: Timecard approval, subcontractor coordination, schedule update
│  ├── Monthly: Payment application, cost review, forecast update, change order processing
│  └── Ongoing: RFIs, submittals, change orders, safety compliance
│
4. SUBSTANTIAL COMPLETION
│  ├── Punch list creation and tracking
│  ├── Final payment application (including retention)
│  ├── Close out submittals (O&M manuals, warranties, as-builts)
│  └── Final change order settlement
│
5. PROJECT CLOSE-OUT
│  ├── Final billing and retention release
│  ├── Final cost reconciliation
│  ├── Subcontract closeout (final pay, retention release, lien waivers)
│  ├── Lessons learned documentation
│  └── Archive project
```

### Daily
1. Review yesterday's daily report from the superintendent
2. Check cost alerts — any cost codes trending over budget?
3. Review and approve timecards (if weekly approval cycle, this happens on Mon/Tue)
4. Review RFI/submittal status — anything overdue?
5. Review subcontractor insurance status — anyone expired?
6. Respond to owner/architect inquiries
7. Update task lists and action items

### Weekly
1. **Timecard approval** — review all field timecards, verify hours and cost codes
2. **Subcontractor coordination meeting** — review schedule, resolve conflicts
3. **Schedule update** — update look-ahead schedule, identify critical path items
4. **Cost code review** — compare committed + spent vs. budget on key cost codes
5. **Change order status** — follow up on pending COs with owner

### Monthly (Billing Cycle)
1. **Create payment application** — update percent complete on each SOV line
2. **Review job cost report** — actual vs. budget by cost code
3. **Update forecast** — estimate to complete (ETC) on every cost code. This is the PM's most important analytical task.
4. **Process subcontractor pay applications** — review sub billings, verify work, approve for payment
5. **Process change orders** — finalize any pending change orders
6. **Project status meeting** — internal review with management
7. **OAC meeting** — owner/architect/contractor monthly meeting

### Project Close-Out
1. Verify all costs are posted and coded correctly
2. Process final billing including retention
3. Ensure all subcontractor retention is released (after final lien waivers)
4. Verify all change orders are executed
5. Final job cost report — actual vs. original budget, variance analysis
6. Archive project documents
7. Post-mortem / lessons learned

---

## 7. Key Reports

| Report | Frequency | Description |
|--------|-----------|-------------|
| **Job Cost Report** | Weekly/Monthly | Budget, committed, cost to date, estimate to complete, estimate at completion, variance — by cost code, phase, and cost type. The PM's primary financial report. |
| **Payment Application (G702/G703)** | Monthly | AIA-format billing to the owner. G702 is the summary; G703 is the SOV detail with percent complete per line. |
| **Change Order Log** | Monthly | All change orders: pending, approved, rejected, with amounts and impact on contract. |
| **Subcontractor Status** | Monthly | Each sub's contract amount, billed to date, paid to date, retention, remaining. |
| **RFI Log** | Weekly | Open RFIs, days outstanding, overdue items. |
| **Submittal Log** | Weekly | Submittal status, overdue items, long-lead items. |
| **Committed Cost Report** | Monthly | All commitments (subcontracts + POs) vs. budget. Shows "buying" performance. |
| **Cash Flow Projection** | Monthly | Expected billings vs. expected costs over time. |
| **Productivity Analysis** | Weekly | Labor hours vs. budget hours by cost code. Are crews on track? |
| **Project Summary Dashboard** | Real-time | Contract amount, billed to date, cost to date, projected margin, percent complete, key metrics. |
| **Over/Under Billing (at job level)** | Monthly | Is this job overbilled or underbilled? Feeds WIP schedule. |
| **Daily Report Summary** | Daily | Weather, manpower, work performed, incidents. |
| **Aging Report (Sub Payables)** | Monthly | What do we owe subs, and how long since their pay app was approved? |
| **Warranty Tracker** | On demand | Warranty expiration dates for all materials/equipment on the project. |

---

## 8. AI Agent Assistance Opportunities

### Cost Management
- **Automatic budget alerts:** AI monitors cost-to-budget ratios and alerts PM when any cost code reaches 80%, 90%, or 100% of budget — before it's overrun, not after.
- **Forecast assistance:** Based on historical spend rate and remaining scope, AI suggests estimate-to-complete for each cost code. PM reviews and adjusts rather than starting from scratch.
- **Cost code classification:** When AP enters an invoice for the PM's job, AI suggests the correct cost code based on vendor, description, PO reference, and historical coding patterns.
- **Change order cost impact:** When a CO is proposed, AI cascades the cost impact through the budget, identifies affected cost codes, and updates the forecast.

### Billing Automation
- **SOV progress suggestion:** Based on cost incurred relative to budget and subcontractor billings received, AI suggests percent complete for each SOV line. PM reviews and adjusts.
- **G702/G703 auto-generation:** Once percents are approved, AI generates the payment application in AIA format, calculates retainage, and reconciles against prior billings.
- **Overbilling detection:** AI flags if the PM is billing ahead of costs in a way that could create WIP exposure.

### Document Management
- **RFI drafting:** PM describes the issue → AI drafts the RFI in standard format with specification references and drawing references.
- **Daily report generation:** Field data (manpower, weather from API, photos) → AI generates the daily report. PM reviews and submits.
- **Change order pricing:** Given scope description and cost code structure, AI suggests a cost estimate based on historical data from similar items.

### Subcontractor Management
- **Insurance compliance monitoring:** AI tracks sub insurance expiration dates and automatically sends reminders before expiration. Blocks pay app processing if expired.
- **Pay app verification:** AI compares sub's billing against contract SOV, checks math, verifies retainage calculation, and flags discrepancies.
- **Lien waiver tracking:** AI tracks which lien waivers are outstanding and reminds AP before processing payment.

### Timecard Intelligence
- **Cost code suggestion:** Based on what work was scheduled and where the employee has been working, AI suggests cost codes for time entry.
- **Hours validation:** AI flags unusual hours (10+ hours without break, hours on a job the employee isn't assigned to, hours exceeding project forecast).
- **Productivity benchmarking:** Compare crew productivity (hours per unit installed) against budget and against other projects doing similar work.

---

## 9. Pain Points in Vista / Legacy Systems That Pitbull Solves

| Vista / Legacy Pain | Pitbull Solution |
|---------------------|-----------------|
| **G702/G703 is created in Excel.** Most PMs export SOV data from Vista, manipulate it in Excel, generate the pay app, and then manually enter billing back into Vista. | **Native G702/G703 generation** from the SOV. Review percents in the system, click generate, produce AIA-format PDF and post to AR simultaneously. |
| **Cost reports are stale.** In Vista, labor costs don't show up until payroll is processed (often a week behind). PMs are making decisions on old data. | **Real-time cost visibility.** Approved timecards show as committed labor cost immediately, even before payroll processes. |
| **Change order tracking is fragmented.** Vista tracks owner COs but the pipeline from potential CO → proposed CO → approved CO is often managed in spreadsheets. | **Full CO lifecycle** in one system: PCO (potential) → COR (proposal sent) → CO (approved). With cost detail, schedule impact, and budget auto-adjustment. |
| **No mobile access for PMs.** Field PMs can't access job cost reports, approve timecards, or check sub compliance from the field. | **Mobile-first design** — PMs can do everything from a phone or tablet on the job site. |
| **RFI/submittal tracking requires separate software.** Vista doesn't have robust document management. PMs use Procore, PlanGrid, or spreadsheets. | **Integrated project documents** — RFIs, submittals, daily reports, and correspondence in the same system as cost and billing. |
| **Forecasting is a manual spreadsheet exercise.** Vista's ETC (estimate to complete) entry is clunky, and PMs avoid it. The WIP schedule suffers. | **Guided forecasting** with AI suggestions. PM updates forecasts monthly with minimal friction. AI pre-fills based on cost curves and PM reviews. |
| **Subcontract management is disjointed.** Subcontract setup in Vista, sub pay apps approved on paper, AP enters the billing manually. | **End-to-end sub workflow:** subcontract issuance → sub submits pay app in portal → PM approves electronically → AP processes payment → lien waiver tracked automatically. |
| **Project setup takes days.** Building SOV, cost codes, and budgets in Vista requires multiple screens and manual entry. | **Template-based project setup.** Clone from a similar project or use standard templates. AI suggests cost code structure based on project type and size. |
| **No single project dashboard.** To understand project health in Vista, you run 5+ reports and mentally aggregate them. | **Real-time project dashboard** — contract, billed, cost, margin, forecast, cash flow, key alerts — all on one screen. |

---

## 10. Schedule of Values (SOV) and Billing Structure

The SOV is the **billing taxonomy** — how the PM breaks down the contract for monthly billing purposes.

```
Example SOV for a $5M Commercial Building:

Line | Description                        | Scheduled Value
-----+------------------------------------+----------------
01   | General Conditions                  | $350,000
02   | Site Work / Earthwork               | $280,000
03   | Concrete Foundations                 | $420,000
04   | Structural Steel                    | $680,000
05   | Exterior Envelope (skin/curtainwall)| $520,000
06   | Roofing                             | $175,000
07   | Interior Framing & Drywall          | $310,000
08   | MEP Rough-In (Mechanical)           | $450,000
09   | MEP Rough-In (Electrical)           | $380,000
10   | MEP Rough-In (Plumbing)             | $290,000
11   | Fire Protection                     | $185,000
12   | Finishes (Flooring, Paint, etc.)    | $340,000
13   | Specialties (Millwork, Accessories) | $120,000
14   | Elevator                            | $210,000
15   | Site Utilities                      | $190,000
     |                                     +----------------
     | TOTAL                               | $4,900,000
     | + Change Order #1                   | $100,000
     | REVISED CONTRACT                    | $5,000,000
```

Each line gets a percent complete each month. The billing = Scheduled Value × % Complete - Previous Billings.

**Retainage:** The owner typically withholds 5-10% of each billing until substantial completion. So on a $100K billing at 10% retainage, the PM bills $100K but only receives $90K. The $10K is "retention" — it's earned revenue but deferred cash.

---

## 11. Cost Code Structure

While the SOV is the billing view, cost codes are the **cost tracking view**. They often map to each other but aren't identical.

```
Typical Cost Code Structure:

Phase.CostCode.CostType

Example:
03.310.L  = Phase 03 (Concrete) | Cost Code 310 (Foundations) | L (Labor)
03.310.M  = Phase 03 (Concrete) | Cost Code 310 (Foundations) | M (Material)
03.310.S  = Phase 03 (Concrete) | Cost Code 310 (Foundations) | S (Subcontractor)
03.310.E  = Phase 03 (Concrete) | Cost Code 310 (Foundations) | E (Equipment)
03.310.O  = Phase 03 (Concrete) | Cost Code 310 (Foundations) | O (Other)

Cost Types:
L = Labor (from timecards)
M = Material (from POs and invoices)
S = Subcontractor (from sub pay apps)
E = Equipment (owned and rented)
O = Other (permits, fees, etc.)
```

Budget is assigned at the cost code + cost type level. All cost transactions post to a specific cost code + cost type. This is how the PM knows, for example, that concrete labor is over budget but concrete material is under.

---

## 12. Key Business Rules

1. **One project, one PM.** Every project has a single PM accountable for its financial performance. Support PMs may assist, but one person owns the margin.
2. **Timecards must be approved before payroll deadline.** The PM is responsible for reviewing and approving timecards by Tuesday (for weekly Thursday pay). Late approval = late pay = angry workers.
3. **Change orders must be approved before costs are incurred.** In practice, work sometimes starts before the CO is signed (owner-directed change). The system must allow cost tracking on pending COs while flagging the risk.
4. **Billing cannot exceed contract value.** Total billings to date cannot exceed original contract + approved change orders. System must enforce this.
5. **Subcontractor pay requires PM approval.** No sub payment processes without the PM reviewing and approving the pay application.
6. **Retention is contract-specific.** Some contracts have 10% retention, some 5%, some have sliding scales (10% to 50% complete, 5% thereafter). The system must support per-contract retention terms.
7. **Cost to complete ≠ 0 until the project is physically done.** PMs have a tendency to show $0 ETC when they think they're done but haven't closed out punch list, retention, or final costs. The system should flag jobs with $0 ETC that aren't in "Complete" status.
8. **Every cost must have a cost code.** No "miscellaneous" bucket. If a cost can't be coded, the cost code structure needs to be updated.
9. **Sub compliance gates payment.** A subcontractor with expired insurance cannot receive payment. Period. The system must enforce this, not just warn.
10. **Daily reports are legal documents.** They may be subpoenaed in disputes. They must be timestamped, uneditable after submission (corrections create new entries), and securely stored.

---

*This document is a living reference for AI agent teams. When building any feature that touches projects, billing, or cost tracking, consult this document to understand the PM's perspective and workflows.*
