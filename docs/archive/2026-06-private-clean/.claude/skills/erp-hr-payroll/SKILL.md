---
name: erp-hr-payroll
description: Construction HR and payroll domain expert. Use when working on employees, time tracking, payroll processing, certified payroll, prevailing wage, Davis-Bacon, or any labor compliance code. Understands union vs non-union, overtime rules, and DOL reporting.
---

# AAI-ERP HR & Payroll Domain — Construction Labor Expert

## Your Role
You understand construction labor management: hiring/onboarding, time tracking, payroll processing, prevailing wage compliance, certified payroll reporting, and DOL requirements.

## Time Entry Workflow

```
Foreman enters time (crew entry) → Submitted
  ↓
Supervisor reviews → Approved or Rejected
  ↓ (if Approved)
Payroll specialist processes → PayrollRun created
  ↓
Export to payroll system (ADP, Paychex) or internal processing
  ↓
Certified payroll report generated (if prevailing wage job)
```

### TimeEntryStatus — values are persisted (order & ints matter for DB)
```csharp
public enum TimeEntryStatus
{
    Submitted = 0,
    Approved = 1,
    Rejected = 2,
    Draft = 3
}
```
See TimeEntry.cs. Workflow comments in code emphasize not changing values.

### Crew Entry
- Foreman enters time for entire crew at once (batch create)
- Must be fast: < 30 seconds per entry on mobile
- Fields: Employee, Project, Cost Code, Phase, Hours (Regular + OT), Date
- Batch limit: 500 entries per request
- Direct service call (not event bus) — foreman needs instant feedback

## Prevailing Wage

### What It Is
Government-mandated minimum pay rates for public works projects. Varies by:
- Trade/classification (electrician, plumber, laborer, etc.)
- Geographic location (county-level)
- Project type (building, heavy highway, residential)

### Davis-Bacon Act
Federal law requiring prevailing wages on federally funded projects ($2,000+).
- Weekly certified payroll reports required (DOL Form WH-347)
- Must report: employee name, classification, hours, pay rate, deductions, net pay
- Penalties for violations: back wages, debarment, criminal prosecution

### Prevailing Wage Determination
```
PrevailingWageDetermination entity:
- WageDecisionNumber (e.g., "CA20260001")
- Trade classification
- Base rate ($/hr)
- Fringe benefit rate ($/hr)
- Total rate = base + fringe
- Effective date range
```

### Overtime Rules
- Federal: 1.5x after 40 hours/week
- California: 1.5x after 8 hours/day, 2x after 12 hours/day
- Some union agreements have different OT thresholds
- Prevailing wage OT: calculated on base rate only, fringe stays flat

## Payroll Processing

### PayrollRun Entity
- Covers a pay period (bi-weekly typically)
- Includes all approved time entries in that period
- Status: Draft → Processing → Complete → Exported
- Must lock pay period after processing (prevent retroactive changes)

### Pay Period Locking
- Pay periods: Open → Closed → Locked
- Open: time entries can be created/edited
- Closed: no new entries, existing can be corrected
- Locked: immutable (audit requirement)

## Employee Onboarding

6-step wizard:
1. Personal info (name, SSN, address)
2. Emergency contacts
3. Tax information (W-4, state withholding)
4. Davis-Bacon/prevailing wage flags
5. Company assignment (multi-company)
6. Compliance documents (I-9, certs, licenses)

CSV bulk import supported for spring hiring surge (50+ new hires).

## Validation Rules
- Time entries: no more than 24 hours per day per employee
- Pay rates: must meet prevailing wage minimums (if flagged)
- Payroll run: all time entries must be Approved
- Pay period: must be Open to accept new entries
- SSN: validate format, never display full (last 4 only in UI)

## Sensitive Data
- SSN, pay rates, tax info require `Employees.ViewSensitive` permission
- Never log PII to application logs
- Encrypt at rest when column-level encryption is implemented
