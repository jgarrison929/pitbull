# Position Paper: HR Core Requirements for Payroll Integration

**Author:** Payroll Integration Specialist  
**Date:** February 8, 2026  
**Subject:** Critical Data Structures HR Core Must Provide to Enable Payroll Processing

---

## Executive Summary

Payroll doesn't generate employee data—it consumes it. Every paycheck we cut depends on HR Core providing accurate, timely, and properly structured information. If HR Core gets this wrong, Payroll will produce incorrect paychecks, tax filings, and certified payroll reports. In construction, these errors trigger union grievances, Department of Labor audits, and contractor debarment. HR Core must be designed with Payroll's consumption patterns as a first-class requirement.

## The Multi-Rate Reality

Construction workers are not single-rate employees. A journeyman electrician might have:
- A base union scale rate
- A different rate on prevailing wage projects
- Shift differentials for night work
- Per diem for travel jobs
- Piece rate bonuses for specific tasks

HR Core must expose an **EmployeePayRates** structure that supports multiple concurrent rate assignments:

```
EmployeePayRates {
  employee_id
  rate_type (hourly | salary | piece | per_diem)
  rate_amount
  effective_date
  expiration_date (nullable)
  project_id (nullable - for project-specific rates)
  job_classification_id
  wage_determination_id (nullable - for prevailing wage)
  shift_code (nullable)
  priority (for rate selection hierarchy)
}
```

Payroll must query this by employee + work date + project + shift and receive the correct rate. The complexity lives in HR Core; Payroll just asks "what do I pay this person for this hour of work?"

## Tax Jurisdiction Determination

Construction workers cross state lines constantly. A worker might live in Oregon, be headquartered from a Washington office, and work a job site in California—all in the same pay period. HR Core must maintain:

- **Home address** (for resident state withholding)
- **Work location history** (tied to timecard job sites)
- **Reciprocity election flags** (when workers elect home-state withholding)
- **SUI state assignment** (often differs from work state)

Payroll needs a **TaxJurisdiction** API that accepts employee_id + work_date + job_site_id and returns the applicable federal, state, and local tax codes. Don't make Payroll figure out California has different rules for construction workers—HR Core should encapsulate that logic.

## Withholding and Deduction Configuration

W-4 data isn't optional metadata—it's the foundation of every tax calculation. HR Core must provide:

- **Federal W-4** (filing status, multiple jobs flag, dependents, other income, deductions, extra withholding)
- **State W-4 equivalents** (each state's form differs)
- **Effective dates** (mid-period W-4 changes are common)

Deductions require similar rigor:

```
EmployeeDeductions {
  employee_id
  deduction_type (benefit | garnishment | union_dues | 401k | other)
  calculation_method (flat | percentage | hours_based)
  amount_or_rate
  cap_amount (nullable)
  ytd_withheld
  effective_date
  expiration_date
  priority (garnishment ordering matters legally)
  arrears_balance (for catch-up calculations)
}
```

## Union and Prevailing Wage Integration

For union contractors, HR Core must track:
- Union affiliation and local number
- Apprentice/journeyman status with progression dates
- Fringe benefit fund assignments (often multiple per local)
- Current wage scale lookups by classification + effective date

For prevailing wage work, HR Core must map employees to wage determinations (Davis-Bacon or state) and provide rate lookups including fringe breakdowns. Certified payroll reports pull directly from this data.

## Workers Compensation Classification

Every employee needs a **workers_comp_class_code** assignment, queryable by Payroll to calculate employer WC premiums and report correctly to insurers. Misclassification here triggers audits and premium penalties.

---

## TOP 3 NON-NEGOTIABLE REQUIREMENTS

1. **Effective-dated, multi-rate pay structure** — Payroll must query a single API with (employee, date, project, job_class) and receive the correct pay rate without additional logic. Rate changes mid-pay-period must be handled cleanly with effective dates.

2. **Tax jurisdiction resolution service** — Given a worker and their work locations for a period, HR Core must return all applicable tax jurisdictions and withholding parameters. Payroll cannot own 50-state tax nexus rules.

3. **Complete W-4 and deduction records with effective dating** — Every withholding election and deduction setup must have effective dates and be queryable as-of any date in the past (for corrections) or present (for processing). Garnishment priority ordering must be explicit.

---

*If Payroll must reverse-engineer employee compensation rules from scattered HR tables, we will ship bugs. Build the APIs Payroll needs, and we'll deliver accurate paychecks.*
