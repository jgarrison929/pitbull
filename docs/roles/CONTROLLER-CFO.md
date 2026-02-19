# Controller / CFO — Functional Role Reference

> **Audience:** AI agent teams building Pitbull Construction Solutions ERP
> **Last updated:** 2026-02-19

---

## 1. Role Description

The Controller (or CFO in smaller firms) is the **chief financial steward** of a construction company. They own the integrity of every dollar recorded in the system. In construction, this role is uniquely complex because the company must maintain **two parallel accounting views**:

- **GAAP / Financial Accounting** — accrual-basis books that satisfy auditors, banks, bonding companies, and the IRS.
- **Job Cost Accounting** — real-time cost tracking at the project/phase/cost-code level that drives operational decisions.

These two views start from the same transactions but diverge in timing, classification, and reporting. The Controller must reconcile them and ensure both are defensible.

### Why This Role Matters to Pitbull

Every transaction in the system — a timecard, an AP invoice, a change order, a billing — eventually flows into the GL. The Controller is the **final gate**. If the system cannot produce auditable, GAAP-compliant financials from its transaction data, the product fails. Period.

### Key Mandate

> **Everything must be auditable and defensible.** No transaction should exist without a source document. No journal entry should post without an approval trail. No report should be unreconcilable.

---

## 2. Core Responsibilities

| Area | Description |
|------|-------------|
| **Chart of Accounts (COA)** | Design and maintain the GL account structure. In construction: revenue accounts by type, COS accounts that map to cost codes, overhead allocations, equipment accounts, retention accounts (both AR and AP). |
| **General Ledger (GL)** | Own the GL. All subledger transactions (AP, AR, Payroll, Job Cost) post to the GL. The Controller reviews, adjusts, and closes periods. |
| **Dual-Book Accounting** | Maintain GAAP financials AND job cost reports from the same underlying data. Revenue recognition (ASC 606 / percentage-of-completion) is the most complex reconciliation. |
| **Financial Reporting** | Balance sheet, income statement, cash flow statement. Construction-specific: WIP schedule, over/under billing analysis, backlog report. |
| **Bonding & Surety** | Prepare financial packages for bonding companies. The bonding company determines how much work the contractor can take on. Bad financials = lower bonding capacity = lost bids. |
| **WIP Schedule** | The Work-in-Progress schedule is THE critical construction financial report. It compares estimated cost to complete vs. billings to date to determine over/under billing on each job. Drives revenue recognition. |
| **Tax Strategy** | Tax entity management, depreciation schedules, R&D credits (yes, construction qualifies), completed-contract vs. percentage-of-completion method elections. |
| **Audit Support** | Produce audit schedules, support external auditors, maintain documentation for every GL balance. |
| **Banking & Cash Management** | Credit facility compliance, covenant reporting, cash flow forecasting. |
| **Internal Controls** | Segregation of duties, approval workflows, transaction limits. The Controller designs the control environment that the system enforces. |

---

## 3. Data Owned (Entities / Tables)

The Controller owns or has final authority over:

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `ChartOfAccounts` | GL account master | AccountNumber, Name, Type (Asset/Liability/Equity/Revenue/Expense), SubType, IsActive, CostCategory |
| `GeneralLedger` | Journal entries and posted transactions | EntryDate, PostDate, AccountId, Debit, Credit, SourceModule, SourceDocId, Description, PostedBy, ApprovedBy |
| `FiscalPeriod` | Period definitions and status | Year, Period, StartDate, EndDate, Status (Open/Closed/Locked), ClosedBy, ClosedAt |
| `BudgetEntry` | Company-level budgets (not job budgets) | AccountId, FiscalYear, Period, Amount |
| `WipSchedule` | WIP calculation snapshots | JobId, PeriodEnd, ContractAmount, EstimatedCost, CostToDate, BillingsToDate, EarnedRevenue, OverUnderBilling |
| `BankAccount` | Bank account master | AccountName, BankName, RoutingNumber, AccountNumber (encrypted), GLCashAccountId, IsActive |
| `RecurringJournalEntry` | Recurring entries (depreciation, allocations) | Frequency, NextRunDate, Template, AutoPost |
| `FinancialStatement` | Generated statement snapshots | StatementType, PeriodEnd, GeneratedAt, Data (JSON), Status |
| `TaxEntity` | Tax reporting entities | EIN, EntityType, FiscalYearEnd, AccountingMethod |
| `RetentionSchedule` | Retention receivable/payable aging | JobId, Type (AR/AP), OriginalAmount, ReleasedAmount, Balance, ReleaseDate |

### GL Account Structure (Construction Standard)

```
1000-1999  Assets
  1000     Cash & Equivalents
  1100     Accounts Receivable
  1150     Retention Receivable
  1200     Costs in Excess of Billings (Underbilling)
  1300     Inventory / Materials
  1400     Prepaid Expenses
  1500     Fixed Assets
  1600     Equipment (owned fleet)
  1700     Accumulated Depreciation

2000-2999  Liabilities
  2000     Accounts Payable
  2050     Retention Payable
  2100     Billings in Excess of Costs (Overbilling)
  2200     Accrued Payroll
  2300     Payroll Tax Liabilities
  2400     Notes Payable
  2500     Line of Credit

3000-3999  Equity
  3000     Retained Earnings
  3100     Owner's Equity / Paid-in Capital
  3200     Current Year Earnings

4000-4999  Revenue
  4000     Contract Revenue
  4100     Change Order Revenue
  4200     T&M Revenue
  4300     Service Revenue

5000-5999  Cost of Sales (Direct Job Costs)
  5000     Labor
  5100     Materials
  5200     Subcontractor
  5300     Equipment
  5400     Other Direct Costs

6000-6999  Overhead / G&A
  6000     Office Salaries
  6100     Rent & Utilities
  6200     Insurance (GL, Umbrella)
  6300     Professional Fees
  6400     Vehicle Expense
  6500     Depreciation

7000-7999  Other Income / Expense
  7000     Interest Income
  7100     Interest Expense
  7200     Gain/Loss on Asset Disposal
```

---

## 4. Modules Used Daily

| Module | Usage |
|--------|-------|
| **General Ledger** | Primary workspace. Review postings, enter JEs, close periods. |
| **Job Cost** | Review cost reports, validate cost-to-date, check budget vs. actual. |
| **Accounts Payable** | Approve large payments, review aging, validate coding. |
| **Accounts Receivable** | Review billing status, cash receipts, retention. |
| **Payroll** | Review payroll journal entries, validate burden rates, check certified payroll compliance. |
| **Financial Reporting** | Generate financials, WIP schedules, bonding packages. |
| **Banking** | Cash position, reconciliations. |
| **System Admin** | Period management, COA changes, user access for finance team. |

---

## 5. Dependencies on Other Roles

| Role | Dependency |
|------|-----------|
| **AP Clerk** | AP posts vendor invoices that hit the GL. Controller relies on correct coding. |
| **AR Clerk** | AR posts billings and cash receipts. Controller relies on proper revenue classification. |
| **Payroll Manager** | Payroll journal entries are the largest recurring GL posting. Must be accurate and timely. |
| **Project Manager** | PM provides cost-to-complete estimates that drive WIP calculations. PM also manages change orders that affect contract value. |
| **HR Director** | Workers' comp rates and employee classifications affect burden calculations. |
| **System Admin** | Period management, user access, module configuration. |

---

## 6. Workflows

### Daily
1. Review overnight batch postings (AP, AR, Payroll) to GL
2. Review cash position across bank accounts
3. Approve any pending journal entries from staff
4. Review exception reports (unbalanced entries, coding errors, missing source docs)
5. Check for any compliance alerts (expired insurance, overdue filings)

### Weekly
1. Review AP aging — ensure upcoming payments are funded
2. Review AR aging — follow up on overdue receivables
3. Review job cost reports for active projects — flag cost overruns
4. Reconcile bank accounts
5. Review and approve payroll before processing

### Monthly (Period Close)
1. Ensure all subledger transactions are posted to GL
2. Post recurring entries (depreciation, insurance allocation, equipment allocation)
3. Review and post accruals (unbilled revenue, accrued expenses)
4. Reconcile all balance sheet accounts
5. Prepare **WIP schedule** for all active jobs
6. Calculate over/under billing adjustments
7. Generate financial statements (P&L, Balance Sheet, Cash Flow)
8. Close the period — prevent further postings
9. Review budget vs. actual for overhead accounts

### Quarterly
1. Prepare estimated tax calculations
2. Update bonding company work-in-progress statement
3. Review and update cost-to-complete estimates with PMs
4. Covenant compliance reporting to banks

### Annually
1. Prepare audit schedules and support year-end audit
2. Finalize tax returns (or package for CPA)
3. Update chart of accounts for new year
4. Review and update company budget
5. Renew bonding program — submit updated financials
6. 1099 reporting coordination with AP

---

## 7. Key Reports

| Report | Frequency | Description |
|--------|-----------|-------------|
| **WIP Schedule** | Monthly | The single most important construction financial report. Contract amount, cost to date, estimated cost to complete, % complete, earned revenue, billings to date, over/under billing. |
| **Balance Sheet** | Monthly | Standard GAAP balance sheet with construction-specific accounts (retention, over/under billing). |
| **Income Statement** | Monthly | Revenue and expenses by job and overhead. |
| **Cash Flow Statement** | Monthly | Operating, investing, financing activities. |
| **Job Profitability Summary** | Monthly | All active jobs with revenue, cost, margin. |
| **Over/Under Billing Report** | Monthly | Net position across all jobs. Bonding companies scrutinize this. |
| **AP Aging** | Weekly | Vendor balances by aging bucket. |
| **AR Aging** | Weekly | Customer balances by aging bucket. |
| **Bank Reconciliation** | Monthly | GL balance vs. bank statement, outstanding items. |
| **Trial Balance** | Monthly | All GL accounts with debit/credit balances. |
| **Backlog Report** | Monthly | Remaining contract value on all open jobs. |
| **Bonding Capacity Report** | Quarterly | Current aggregate bonding limits vs. committed work. |
| **Budget vs. Actual** | Monthly | Overhead accounts actual vs. budget. |
| **Audit Trail** | On demand | Who posted what, when, from what source document. |

---

## 8. AI Agent Assistance Opportunities

### High-Impact Automation
- **Auto-classify GL postings:** When AP enters an invoice, AI suggests the GL account based on vendor history, PO data, and cost code mapping. Controller reviews exceptions, not every entry.
- **WIP schedule auto-calculation:** Given cost-to-date, PM estimates, and billing data, auto-generate the WIP schedule monthly. Controller reviews and adjusts.
- **Anomaly detection:** Flag unusual journal entries, duplicate postings, entries that don't match historical patterns, or entries posted by someone without normal authority.
- **Period close checklist:** AI tracks which close tasks are done, which are pending, and prompts the Controller through the sequence.
- **Bank reconciliation matching:** Auto-match cleared items between bank feed and GL. Surface unmatched items for review.
- **Revenue recognition:** Auto-calculate percentage-of-completion revenue based on cost-to-cost method. Controller approves.
- **Intercompany eliminations:** For multi-entity contractors, auto-generate elimination entries.

### GAAP Compliance Guardrails
- **Prevent posting to closed periods** without Controller override.
- **Enforce balanced journal entries** — debits must equal credits.
- **Require source document linkage** — no JE posts without a reference to the originating transaction.
- **Segregation of duties enforcement** — the person who enters a JE cannot also approve it.
- **Retention calculation validation** — ensure retention percentages match contract terms.
- **Cost code validation** — ensure job costs hit valid cost codes within the right cost categories.

### Reporting Intelligence
- **Natural language queries:** "What's our over/under billing position this month?" → generate from WIP data.
- **Trend analysis:** Compare WIP schedules across periods to identify jobs trending toward loss.
- **Cash flow forecasting:** Based on billing schedule, AP commitments, and payroll projections.
- **Bonding package assembly:** Auto-compile financial statements, WIP schedule, backlog, and supporting schedules into bonding submission format.

---

## 9. Pain Points in Vista / Legacy Systems That Pitbull Solves

| Vista / Legacy Pain | Pitbull Solution |
|---------------------|-----------------|
| **Rigid COA structure** — changing account numbers requires extensive remapping and historical data becomes hard to compare. | Flexible COA with aliasing. Accounts can be restructured without losing historical drill-down. |
| **WIP schedule is a manual spreadsheet** — even in Vista, most Controllers export to Excel to build WIP. | WIP schedule is a **first-class module** with automatic calculation, historical tracking, and auditor-ready formatting. |
| **Period close takes days** — manual checklist, chasing departments to post. | Automated close workflow with status dashboard. AI tracks completion and prompts outstanding items. |
| **Dual-book reconciliation nightmare** — job cost and GL are separate systems that must reconcile. When they don't, it's days of detective work. | Single transaction, dual view. Every posting hits both the GL and job cost simultaneously. Reconciliation is automatic. |
| **No real-time visibility** — financials are only available after month-end close. | Real-time dashboards. Pre-close estimates available anytime. |
| **Audit trail gaps** — Vista's audit log is hard to query and doesn't capture all changes. | Immutable audit log on every entity. Every field change is tracked with user, timestamp, and previous value. |
| **Report writer complexity** — Crystal Reports or SSRS require developer involvement. | Self-service reporting with AI assistance. Natural language queries against structured data. |
| **Bank reconciliation is manual** — CSV imports, manual matching. | Direct bank feed integration with auto-matching and exception surfacing. |
| **Multi-entity is painful** — separate databases, manual consolidation. | Multi-entity in a single database with proper isolation, consolidated reporting, and automated eliminations. |
| **Bonding packages take a week** — compiling financials, WIP, backlog, and supporting schedules is a manual assembly job. | One-click bonding package generation from live data. |

---

## 10. Integration Points

```
                    ┌──────────────┐
                    │  Controller  │
                    │   (GL Hub)   │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
    │    AP      │   │    AR     │   │  Payroll   │
    │ Subledger  │   │ Subledger │   │ Subledger  │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼───────┐
                    │   Job Cost   │
                    │   Module     │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  WIP / Rev   │
                    │  Recognition │
                    └──────────────┘
```

### Subledger → GL Posting Rules
- AP Invoice approved → Debit expense/job cost account, Credit AP
- AR Billing created → Debit AR, Credit Revenue (or Billings in Excess per WIP)
- Cash Receipt applied → Debit Cash, Credit AR
- Payroll processed → Debit labor cost accounts, Credit Payroll Liabilities
- Retention withheld → Debit Retention Receivable, Credit AR (on billings)
- Retention released → Debit AP, Credit Retention Payable (on payments)

---

## 11. Key Business Rules

1. **No transaction posts to GL without a source module reference.** Every GL line traces back to an AP invoice, AR billing, payroll batch, or manual JE with supporting documentation.
2. **Retention is tracked separately.** It is NOT just a line item — it has its own GL accounts and its own aging.
3. **WIP adjustments are journal entries.** The WIP schedule produces over/under billing amounts that become adjusting entries to align GAAP revenue with billings.
4. **Cost categories matter.** Every dollar of job cost must be classified: Labor, Material, Subcontractor, Equipment, Other. These categories drive margin analysis and estimating feedback loops.
5. **Burden rates are calculated, not guessed.** Labor burden (taxes, insurance, benefits) is applied as a percentage on top of base wages. The Controller sets these rates annually based on actual costs.
6. **Fiscal periods are sacred.** Once closed, a period can only be reopened by the Controller with a documented reason. Reopening triggers an audit log entry.
7. **Multi-entity transactions require intercompany entries.** If Entity A pays Entity B's vendor, intercompany receivable/payable entries must be created automatically.

---

*This document is a living reference for AI agent teams. When building any feature that touches financial data, consult this document to understand the Controller's perspective and constraints.*
