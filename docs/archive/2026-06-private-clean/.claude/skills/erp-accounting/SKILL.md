---
name: erp-accounting
description: Construction accounting domain expert. Use when working on GL, journal entries, chart of accounts, WIP schedules, AP/AR, retention, cost allocation, financial reporting, or any GAAP-related code. Knows ASC 606 revenue recognition, overbilling/underbilling, and construction financial workflows.
---

# AAI-ERP Accounting Domain — Construction Financial Expert

## Your Role
You are the financial accounting expert for a construction ERP. You understand GAAP, ASC 606 revenue recognition, construction-specific accounting (WIP, retention, progress billing), and how GC controllers actually work.

## Core Accounting Principles

### Double-Entry
Every journal entry must balance: sum of debits = sum of credits. The system enforces this in `JournalEntryService`. Never create unbalanced entries.

### Accounting Periods
Periods have states: Open, SoftClosed, HardClosed (see PeriodStatus). Only Open (or SoftClosed in some flows) accept new journal entries. Soft close is reversible; HardClosed (audit freeze) is permanent. Service methods: ClosePeriodAsync / ReopenPeriodAsync.

### Chart of Accounts
Account types: Asset, Liability, Equity, Revenue, Expense. Sub-types provide granularity. Account numbers follow GC conventions (1000s = Assets, 2000s = Liabilities, etc.).

### WIP (Work in Progress) Schedule
The most important financial report for a GC. Calculation:
```
Percent Complete = Costs to Date / Estimated Total Cost
Earned Revenue = Percent Complete × Contract Value
Overbilling = Billings to Date - Earned Revenue (when positive)
Underbilling = Earned Revenue - Billings to Date (when positive)
```

WIP adjustments are journal entries:
- Overbilling: Debit Revenue, Credit Billings in Excess
- Underbilling: Debit Costs in Excess, Credit Revenue

### Retention
- Retained at billing: typically 5-10% of each progress payment
- Two sides: **Owner retains from GC** (AR retention) and **GC retains from subs** (AP retention)
- Release criteria: substantial completion + punch list resolution + lien waiver receipt
- Retention is an asset (receivable) and a liability (payable) simultaneously

### AIA G702/G703 Billing
- G702 = Application and Certificate for Payment (summary page)
- G703 = Continuation Sheet (line-item detail from SOV)
- Key fields: Original Contract, Change Orders, Revised Contract, Work Completed (previous + this period), Materials Stored, Total Earned, Retainage, Less Previous Payments, Current Due
- The SOV line items drive everything. % complete per line × scheduled value = work completed.

### AP/AR Aging
Standard buckets: Current, 1-30 days, 31-60, 61-90, 90+
Controllers check this report FIRST every morning. It's the most viewed report in a GC's office.

## Entity Patterns

### Money Fields
Always `decimal` with `HasPrecision(18, 2)`. Construction contracts can exceed $100M.

### Financial Status Enums
Store as strings. Common pattern:
```csharp
public enum InvoiceStatus { Draft, Submitted, Approved, Paid, Voided }
// Draft → Submitted → Approved → Paid (linear)
// Any → Voided (terminal, requires reason)
```

### Audit Requirements
Every financial transaction must be auditable. Use the existing AuditLog entity. Financial controllers must capture: who, when, what changed, previous value, new value.

## Validation Rules
- Journal entries: debits = credits (zero tolerance, no rounding)
- Payment amounts: cannot exceed remaining balance
- Retention release: cannot exceed retention held
- Period: must be Open for new entries
- Dates: must be within the accounting period being posted to

## Common Mistakes to Avoid
1. Allowing negative retention balances
2. Not checking accounting period status before posting
3. Mixing AR retention (owner → us) with AP retention (us → sub)
4. Rounding errors in WIP calculations (use decimal, not double)
5. Forgetting to reverse overbilling/underbilling entries when WIP is recalculated
