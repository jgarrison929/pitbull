# Payroll Module - Overview

## Purpose
Calculate and process payroll for construction companies with:
- Mixed workforce (union + non-union, field + office)
- Multi-state operations
- Certified payroll (Davis-Bacon, prevailing wage)
- Union fringe remittance
- Heavy equipment costing

## Core Entities

### 1. PayPeriod
Defines payroll processing windows.
```
- Id, TenantId
- StartDate, EndDate
- PayDate
- PayFrequency (Weekly, BiWeekly, SemiMonthly, Monthly)
- Status (Open, Processing, Approved, Closed)
- ProcessedBy, ProcessedAt
```

### 2. PayrollBatch
Groups time entries for a pay period.
```
- Id, TenantId
- PayPeriodId
- BatchNumber
- Status (Draft, Calculated, Approved, Posted)
- TotalGross, TotalNet, TotalEmployerCost
- CreatedBy, ApprovedBy
```

### 3. PayrollEntry (one per employee per batch)
```
- Id, TenantId, PayrollBatchId, EmployeeId
- RegularHours, OvertimeHours, DoubleTimeHours
- RegularPay, OvertimePay, DoubleTimePay
- GrossPay
- FederalWithholding, StateWithholding, LocalWithholding
- SocialSecurity, Medicare
- Deductions (JSON array)
- NetPay
- UnionFringes (JSON - H&W, Pension, Training)
- BurdenRate, TotalEmployerCost
```

### 4. PayrollDeductionLine
Individual deduction applied to a payroll entry.
```
- Id, PayrollEntryId, DeductionId
- Amount, YTDBefore, YTDAfter
```

### 5. CertifiedPayrollReport
Davis-Bacon / prevailing wage compliance reports.
```
- Id, TenantId, ProjectId
- WeekEndingDate
- ContractNumber, ContractorName
- Status (Draft, Submitted, Accepted)
- WH347Data (JSON - formatted for DOL)
```

### 6. UnionRemittance
Track fringe benefit payments to union halls.
```
- Id, TenantId
- UnionLocal, PayPeriodId
- TotalHealthWelfare, TotalPension, TotalTraining
- TotalDues
- Status (Pending, Paid)
- CheckNumber, PaidDate
```

## Key Features

### Payroll Calculation
1. Pull approved time entries for period
2. Apply pay rates (base, shift differential, project-specific)
3. Calculate OT/DT based on rules (weekly, daily, CA rules)
4. Apply withholdings (federal, state, local)
5. Apply deductions (benefits, garnishments, union dues)
6. Calculate employer burden (FICA, FUTA, SUTA, workers comp)
7. Calculate union fringes

### Certified Payroll (WH-347)
- Auto-generate from time entries
- Prevailing wage rate validation
- Apprentice ratio tracking
- DOL-compliant format export

### Union Fringe Tracking
- Calculate by employee, project, union
- Generate remittance reports
- Track payment status

### Multi-State Compliance
- Reciprocal agreements
- Work-state vs residence-state
- State-specific OT rules (CA daily OT)

## API Endpoints

### PayPeriods
- `POST /api/payroll/periods` - Create pay period
- `GET /api/payroll/periods` - List periods
- `GET /api/payroll/periods/{id}` - Get period details
- `POST /api/payroll/periods/{id}/close` - Close period

### PayrollBatches
- `POST /api/payroll/batches` - Create batch from period
- `GET /api/payroll/batches/{id}` - Get batch with entries
- `POST /api/payroll/batches/{id}/calculate` - Run payroll calc
- `POST /api/payroll/batches/{id}/approve` - Approve for posting
- `POST /api/payroll/batches/{id}/post` - Post to GL

### CertifiedPayroll
- `POST /api/payroll/certified` - Generate certified report
- `GET /api/payroll/certified/project/{id}` - Reports by project
- `GET /api/payroll/certified/{id}/wh347` - Export WH-347 PDF

### UnionRemittance
- `GET /api/payroll/union-remittance` - Pending remittances
- `POST /api/payroll/union-remittance/{id}/mark-paid` - Record payment

## Dependencies
- HR Module (Employees, PayRates, Deductions, UnionMemberships)
- TimeTracking Module (TimeEntries)
- Projects Module (for certified payroll)

## Phase 1 Scope
1. PayPeriod + PayrollBatch CRUD
2. Basic PayrollEntry calculation (hours × rate)
3. Withholding calculations (federal, state)
4. Deduction processing
5. Net pay calculation

## Phase 2 Scope
1. Certified payroll (WH-347)
2. Union fringe tracking
3. Multi-state compliance
4. Vista export integration
