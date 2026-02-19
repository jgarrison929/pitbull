# Payroll Compliance Module — Design Spec

**Author:** Codex (for Pitbull team)  
**Date:** 2026-02-19  
**Status:** Ready for implementation planning  
**Target Modules:** `Pitbull.TimeTracking` (source hours), `Pitbull.Payroll` (new), `Pitbull.Accounting` (GL/tax liabilities), `Pitbull.Core` (employee/company settings), `Pitbull.Reports`  
**Domain References:** `docs/roles/PAYROLL-MANAGER.md`, `docs/roles/HR-DIRECTOR.md`, `docs/plans/GL-ACCOUNTING-SPEC.md`, `docs/plans/DATA-FLOW-ARCHITECTURE.md`

---

## 0) Purpose
Construction payroll is materially more complex than standard payroll because one worker can cross project types, wage determinations, union rules, and tax jurisdictions within a single pay cycle.

This spec defines a compliance-grade payroll foundation for:
1. Certified payroll (WH-347) generation.
2. Prevailing wage and fringe compliance.
3. Multi-state tax withholding and deposit scheduling.
4. Union and workers' comp reporting.
5. End-to-end pay period workflow from approved time to distribution.

This is a design spec, not code.

---

## 1) Strategic Context and Principles

### 1.1 Why this module exists
1. Ensure payroll accuracy for mixed funding and mixed labor models (union/open shop).
2. Eliminate duplicate data entry between time, payroll, certified payroll, and reporting.
3. Provide auditable compliance controls to reduce DOL/state enforcement risk.
4. Make payroll a first-class financial producer for GL, AP cash disbursement, and forecasting.

### 1.2 Design principles
1. **Single source for hours:** payroll consumes approved time records, not manual re-entry.
2. **Rule-driven, company-configurable:** tax rules, union rules, and prevailing wage behavior use settings/tables, not hardcoded logic.
3. **Compliance by default:** block or hard-flag known non-compliant states (below-rate prevailing wage, missing class code, missing tax setup).
4. **Traceability:** every paycheck line must trace to time entries, rate sources, and posting lines.
5. **Dual perspective:** support GAAP posting and job-cost allocation from the same payroll batch.

### 1.3 Module settings pattern
Introduce `PayrollComplianceSettings` (company-scoped) with defaults:
- `DefaultPayFrequency` (`Weekly`, `BiWeekly`, etc.)
- `CertifiedPayrollEnabled`
- `PrevailingWageEnforcementMode` (`Block`, `Warn`)
- `OvertimeRuleSet` (`FLSA`, state override)
- `FederalDepositorSchedule` (`Monthly`, `SemiWeekly`)
- `MissingTimecardEscalationHours`
- `OtimeWarningThresholdHours` (default 38)
- `RequireWorkersCompClassCodeBeforePayroll` (default true)

---

## 2) Certified Payroll (WH-347)

### 2.1 Objectives
1. Generate compliant weekly certified payroll output for federal/state prevailing wage jobs.
2. Reuse normal payroll/time data; no separate certified payroll data entry workflow.
3. Support amendment/replacement submissions with full audit history.

### 2.2 Entities
All entities inherit `BaseEntity`; company-scoped entities implement `ICompanyScoped`.

### `CertifiedPayrollWeek` (company-scoped)
- `CompanyId`, `ProjectId`, `WeekEndingDate`
- `WageDeterminationId`
- `Status` (`Draft`, `Validated`, `Submitted`, `Amended`)
- `SubmissionReference`, `SubmittedAt`, `SubmittedBy`
- `IsCorrection`, `CorrectsCertifiedPayrollWeekId?`

### `CertifiedPayrollEmployeeLine` (company-scoped)
- `CertifiedPayrollWeekId`, `EmployeeId`
- `WorkClassification` (Davis-Bacon/state class)
- `ApprenticeLevel?`
- `DailyHoursSun` ... `DailyHoursSat`
- `TotalStraightTimeHours`, `TotalOvertimeHours`
- `BaseHourlyRate`, `FringeHourlyRate`, `CashFringeHourlyRate`
- `GrossPay`, `DeductionsJson`, `NetPay`

### `CertifiedPayrollStatementOfCompliance` (company-scoped)
- `CertifiedPayrollWeekId`
- `SignerUserId`, `SignerTitle`
- `SignedAt`
- `ExceptionsExplanation?`

### 2.3 WH-347 generation rules
1. Certified payroll is generated weekly regardless of pay frequency.
2. Only approved time tied to prevailing wage projects can populate WH-347 lines.
3. Classification/rate must match effective wage determination for date + county + trade.
4. Fringe obligation is validated as `base + fringe required` with benefit credits and cash-in-lieu handling.
5. Resubmissions preserve original plus amended versions (no destructive overwrite).

### 2.4 APIs
- `POST /api/payroll/certified-payroll/weeks/generate`
- `GET /api/payroll/certified-payroll/weeks?projectId=&weekEnding=`
- `GET /api/payroll/certified-payroll/weeks/{id}`
- `GET /api/payroll/certified-payroll/weeks/{id}/wh347?format=pdf|json|xml`
- `POST /api/payroll/certified-payroll/weeks/{id}/validate`
- `POST /api/payroll/certified-payroll/weeks/{id}/submit`
- `POST /api/payroll/certified-payroll/weeks/{id}/amend`

---

## 3) Prevailing Wage Rate Tables (Federal + State)

### 3.1 Objectives
1. Normalize wage determination ingestion (Davis-Bacon + state determinations).
2. Resolve applicable rate by project location, funding source, trade/classification, and effective date.
3. Handle determinations, modifications, supersessions, and lock-at-payroll behavior.

### 3.2 Entities
### `WageDetermination` (company-scoped)
- `CompanyId`
- `JurisdictionType` (`Federal`, `State`, `Local`)
- `JurisdictionCode` (state/local code)
- `DeterminationNumber`
- `County`, `ConstructionType`
- `EffectiveDate`, `ExpirationDate?`
- `SourceDocumentId?`, `Status` (`Active`, `Superseded`, `Expired`)

### `WageDeterminationRate` (company-scoped)
- `WageDeterminationId`
- `ClassificationCode`, `ClassificationDescription`
- `BaseRate`, `FringeRate`
- `OvertimeRule` (per classification if required)
- `ApprenticeProgramCode?`, `ApprenticeStep?`, `ApprenticeRatioRule?`

### `ProjectWageAssignment` (company-scoped)
- `ProjectId`, `WageDeterminationId`
- `FundingSource` (`Federal`, `State`, `PrivateMixed`)
- `EffectiveStartDate`, `EffectiveEndDate?`

### `EmployeeProjectClassification` (company-scoped)
- `EmployeeId`, `ProjectId`
- `ClassificationCode`
- `AssignedBy`, `AssignedAt`
- `OverrideRate?`, `OverrideReason?`

### 3.3 Business rules
1. Determination selection hierarchy: project assignment override -> project default -> company default by jurisdiction.
2. Superseding determination can be configured as:
- `ApplyProspectiveOnly`
- `ApplyAtNextPayroll`
- `RequireManualCutover`
3. Payroll line calculation must store resolved rate source snapshot for audit.
4. Below-required rate is blocked or warned per `PayrollComplianceSettings.PrevailingWageEnforcementMode`.

### 3.4 APIs
- `POST /api/payroll/wage-determinations/import`
- `GET /api/payroll/wage-determinations`
- `GET /api/payroll/wage-determinations/{id}`
- `PUT /api/payroll/wage-determinations/{id}`
- `POST /api/payroll/projects/{projectId}/wage-assignments`
- `PUT /api/payroll/projects/{projectId}/employee-classifications/{employeeId}`

---

## 4) Fringe Benefit Tracking (Union and Non-Union)

### 4.1 Objectives
1. Compute fringe obligations per hour by labor context.
2. Distinguish employer-paid fringe vs employee deductions.
3. Support cash-in-lieu when benefit credits do not satisfy required fringe.

### 4.2 Entities
### `FringePlan` (company-scoped)
- `CompanyId`
- `PlanType` (`UnionTrust`, `CompanyBenefit`, `CashInLieu`)
- `Name`, `Status`

### `FringeRateSchedule` (company-scoped)
- `FringePlanId`
- `UnionLocalId?`, `ClassificationCode?`, `ProjectId?`, `StateCode?`
- `RateType` (`Hourly`, `PercentGross`)
- `RateValue`
- `EffectiveDate`, `EndDate?`

### `PayrollFringeDetail` (company-scoped)
- `PayrollDetailId`
- `FringePlanId`
- `Hours`, `Rate`, `Amount`
- `Funding` (`EmployerPaid`, `EmployeeDeduction`, `CashInLieu`)

### `FringeRemittanceBatch` (company-scoped)
- `CompanyId`, `ReportMonth`
- `UnionLocalId?`, `PlanId?`
- `Status` (`Draft`, `Approved`, `Exported`, `Paid`)
- `TotalHours`, `TotalAmountDue`

### 4.3 Rules
1. Union trust fringe is primarily employer liability; employee contribution handled separately when required by CBA.
2. Required prevailing fringe shortfall automatically generates cash fringe earning line.
3. Fringe calculations are versioned by effective date and plan schedule.
4. Remittance outputs support local-specific layouts.

### 4.4 APIs
- `POST /api/payroll/fringe/plans`
- `POST /api/payroll/fringe/rates`
- `GET /api/payroll/fringe/rates/effective?projectId=&employeeId=&workDate=`
- `GET /api/payroll/fringe/remittances?month=`
- `POST /api/payroll/fringe/remittances/{id}/export`

---

## 5) Multi-State Tax Withholding

### 5.1 Objectives
1. Determine withholding jurisdiction from work state, resident state, reciprocity, and local tax rules.
2. Split wages by jurisdiction for accurate liability and filing.
3. Maintain auditable tax setup and effective-dated tables.

### 5.2 Entities
### `TaxJurisdiction` (company-scoped)
- `CompanyId`
- `TaxType` (`Federal`, `StateIncome`, `LocalIncome`, `SUTA`, `SDI`)
- `JurisdictionCode`
- `FilingFrequencyDefault`
- `DepositScheduleDefault`

### `TaxRateTable` (company-scoped)
- `TaxJurisdictionId`
- `EffectiveDate`, `EndDate?`
- `CalculationMethod` (`Bracket`, `Flat`, `Percentage`) 
- `RateDataJson`

### `EmployeeTaxProfile` (company-scoped)
- `EmployeeId`
- `ResidenceState`, `WorkStateOverride?`
- `FilingStatus`, `Allowances`, `AdditionalWithholding`
- `ReciprocityExemptionState?`, `ExemptionCertificateOnFile`

### `PayrollTaxDetail` (company-scoped)
- `PayrollDetailId`
- `TaxJurisdictionId`
- `TaxableWages`, `WithheldAmount`, `EmployerAmount`

### 5.3 Rules
1. Jurisdiction determination uses work-location-derived state by default from time entries/project location.
2. Reciprocity agreements suppress duplicate state withholding when valid exemption exists.
3. Local taxes apply by local rules (work city, resident city, school district).
4. Missing tax profile blocks payroll inclusion unless explicit override approval.

### 5.4 APIs
- `POST /api/payroll/taxes/jurisdictions`
- `POST /api/payroll/taxes/rates/import`
- `GET /api/payroll/taxes/rates/effective?jurisdiction=&date=`
- `PUT /api/payroll/employees/{employeeId}/tax-profile`
- `GET /api/payroll/batches/{batchId}/tax-summary`

---

## 6) Union Reporting (Hours, Fringes, Remittance)

### 6.1 Objectives
1. Aggregate payroll hours and fringe amounts by union local + classification.
2. Produce monthly trust fund remittance outputs.
3. Track union dues/deductions and payment status.

### 6.2 Entities
### `UnionLocal` (company-scoped)
- `CompanyId`
- `LocalNumber`, `UnionName`, `Jurisdiction`
- `RemittanceFormat` (`CSV`, `PDF`, `PortalUploadTemplate`)

### `UnionMembership` (company-scoped)
- `EmployeeId`, `UnionLocalId`
- `MemberNumber`, `ClassificationCode`, `DispatchHall?`
- `StartDate`, `EndDate?`, `Status`

### `UnionRemittanceLine` (company-scoped)
- `FringeRemittanceBatchId`
- `EmployeeId`, `UnionLocalId`
- `ClassificationCode`, `Hours`
- `PensionAmount`, `HealthWelfareAmount`, `TrainingAmount`, `OtherAmount`, `TotalAmount`

### 6.3 Rules
1. Employee may be union on one project and non-union on another; remittance line driven by time line context.
2. Apprentice/journeyman rates and ratios are validated against CBA/determination data.
3. Remittance batches are immutable after export unless reopened with audit reason.

### 6.4 APIs
- `POST /api/payroll/unions/locals`
- `PUT /api/payroll/unions/memberships/{employeeId}`
- `POST /api/payroll/unions/remittances/generate`
- `GET /api/payroll/unions/remittances/{id}`
- `POST /api/payroll/unions/remittances/{id}/approve`
- `POST /api/payroll/unions/remittances/{id}/export`

---

## 7) Workers' Comp Class Codes and Rates

### 7.1 Objectives
1. Enforce class code assignment and track payroll by class code/state.
2. Produce audit-ready workers' comp payroll summaries.
3. Support effective-dated WC rates for burden allocation.

### 7.2 Entities
### `WorkersCompClassCode` (company-scoped)
- `CompanyId`
- `Code`, `Description`
- `StateCode`
- `EffectiveDate`, `EndDate?`

### `WorkersCompRate` (company-scoped)
- `WorkersCompClassCodeId`
- `RatePer100Payroll`
- `EffectiveDate`, `EndDate?`

### `EmployeeWorkersCompAssignment` (company-scoped)
- `EmployeeId`, `WorkersCompClassCodeId`
- `EffectiveDate`, `EndDate?`

### `WorkersCompPayrollSummary` (company-scoped)
- `CompanyId`, `PeriodStart`, `PeriodEnd`
- `StateCode`, `ClassCode`
- `PayrollAmount`, `EstimatedPremium`

### 7.3 Rules
1. Employees must have active WC class assignment before first payroll calculation.
2. Payroll line posted without WC class assignment is blocked unless controller override.
3. WC summary format supports auditor-friendly totals by class/state/employee.

### 7.4 APIs
- `POST /api/payroll/workers-comp/class-codes`
- `POST /api/payroll/workers-comp/rates`
- `PUT /api/payroll/employees/{employeeId}/workers-comp-assignment`
- `GET /api/payroll/workers-comp/summary?periodStart=&periodEnd=&state=`

---

## 8) Pay Period Processing Workflow

### 8.1 Workflow stages
`Collect Time -> Validate -> Calculate -> Approve -> Distribute -> Post`

### 8.2 Core entities
### `PayrollBatch` (company-scoped)
- `CompanyId`, `PayPeriodId`, `BatchNumber`
- `Status` (`Draft`, `Collecting`, `Validating`, `Calculated`, `PendingApproval`, `Approved`, `Distributed`, `Posted`, `Voided`)
- `PayDate`, `CalculatedAt`, `ApprovedAt`, `PostedAt`
- `TotalGross`, `TotalNet`, `TotalEmployerBurden`, `EmployeeCount`

### `PayrollDetail` (company-scoped)
- `PayrollBatchId`, `EmployeeId`
- `RegularHours`, `OvertimeHours`, `DoubleTimeHours`
- `GrossPay`, `PreTaxDeductions`, `TaxWithholding`, `PostTaxDeductions`, `NetPay`
- `ValidationStatus`, `ValidationErrorsJson`

### `PayrollDistribution` (company-scoped)
- `PayrollDetailId`
- `DistributionMethod` (`DirectDeposit`, `Check`, `PayCard`)
- `DistributionStatus` (`Pending`, `Sent`, `Failed`, `Voided`)
- `ExternalReference?`

### 8.3 Validation gates
1. Only approved time entries are eligible, except configured salaried auto-pay.
2. Required checks:
- missing timecards for active assigned employees
- invalid/missing project/cost code
- below prevailing wage rate
- missing tax profile
- missing WC class code
- union local/class mismatch
3. Batch cannot move to `PendingApproval` while blocking validations exist.

### 8.4 APIs
- `POST /api/payroll/batches`
- `POST /api/payroll/batches/{id}/collect-time`
- `POST /api/payroll/batches/{id}/validate`
- `POST /api/payroll/batches/{id}/calculate`
- `GET /api/payroll/batches/{id}/exceptions`
- `POST /api/payroll/batches/{id}/submit-approval`
- `POST /api/payroll/batches/{id}/approve`
- `POST /api/payroll/batches/{id}/distribute`
- `POST /api/payroll/batches/{id}/post`
- `POST /api/payroll/batches/{id}/void`

---

## 9) Tax Deposit Scheduling and Filing Calendar

### 9.1 Objectives
1. Compute and schedule deposit obligations for federal/state/local payroll taxes.
2. Reconcile liabilities to deposits.
3. Generate filing-ready summaries (941 and equivalents).

### 9.2 Entities
### `TaxDepositObligation` (company-scoped)
- `CompanyId`, `PayrollBatchId?`
- `TaxJurisdictionId`, `TaxPeriodStart`, `TaxPeriodEnd`
- `LiabilityAmount`, `DueDate`
- `DepositScheduleType` (`Monthly`, `SemiWeekly`, `Quarterly`, `Other`)
- `Status` (`Open`, `Scheduled`, `Submitted`, `Paid`, `Overdue`)

### `TaxDepositPayment` (company-scoped)
- `TaxDepositObligationId`
- `PaymentDate`, `Amount`
- `PaymentMethod`, `ReferenceNumber`
- `Status`

### `TaxFilingReport` (company-scoped)
- `CompanyId`
- `FormType` (`941`, `StateQuarterly`, `LocalReturn`, `FUTA940`)
- `PeriodStart`, `PeriodEnd`
- `Status` (`Draft`, `Ready`, `Filed`, `Amended`)
- `DataJson`, `FiledAt?`, `FiledBy?`

### 9.3 Rules
1. Deposit schedule defaults by jurisdiction but can vary by company lookback/agency assignment.
2. Deposits are tracked against liability buckets; partial payments supported.
3. Filing reports reconcile against posted payroll tax detail and deposit payments.

### 9.4 APIs
- `GET /api/payroll/taxes/deposits?status=&dueBefore=`
- `POST /api/payroll/taxes/deposits/{id}/schedule`
- `POST /api/payroll/taxes/deposits/{id}/mark-paid`
- `POST /api/payroll/taxes/filings/generate`
- `GET /api/payroll/taxes/filings/{id}`

---

## 10) Integration with Time Tracking

### 10.1 Source contract
Payroll consumes approved labor data from `Pitbull.TimeTracking`:
- `TimeEntry` (approved hours, cost code, phase, project)
- `PayPeriod` (boundary and lock)
- `Employee`, `ProjectAssignment`, `CostCode`

### 10.2 Integration events
- `TimeEntryApproved`
- `TimeEntryCorrected`
- `PayPeriodClosed`
- `PayrollBatchPosted`

### 10.3 Handoff rules
1. Payroll snapshot captures eligible approved time at collection stage.
2. Retro corrections after `Calculated` generate explicit delta adjustments (not silent mutation).
3. Time lines retain source references in payroll detail:
- `SourceTimeEntryId`
- `SourceRateResolutionId`
- `SourceValidationSnapshotId`

### 10.4 GL/AP integration points
1. `PayrollBatchPosted` publishes accounting events for journal creation (wages, taxes, burden, benefits).
2. Union fringe remittance and tax deposits can produce AP payment candidates.
3. Reconciliation endpoints compare payroll subledger liabilities vs GL balances.

---

## 11) AI Opportunities

### 11.1 Compliance classification and rate support
1. Auto-classify labor lines as prevailing vs non-prevailing using project funding + wage assignment context.
2. Flag rate discrepancies before calculate/post:
- below required base
- fringe shortfall
- stale classification mapping

### 11.2 Certified payroll automation
1. Generate WH-347 drafts directly from approved time + payroll lines.
2. Auto-detect likely statement-of-compliance exceptions.
3. Validate employee/project classification mismatches with confidence scoring.

### 11.3 Tax and jurisdiction intelligence
1. Detect multi-state withholding misconfiguration from cross-state hours.
2. Predict deposit amounts and due-date risk from in-flight payroll trends.
3. Recommend jurisdiction registrations when first work appears in new state/locality.

### 11.4 Governance for AI actions
1. AI may prepare drafts and validations; humans approve filings, payments, and final payroll post.
2. AI-created artifacts must record confidence, source features, and human disposition.
3. High-risk actions (tax payment, payroll approval, filing submission) require human-only execution.

---

## 12) Predictive Features

### 12.1 Payroll readiness dashboard (before period close)
Pre-close scorecard for each active pay period:
- % approved hours vs expected scheduled hours
- missing timecards by supervisor/project
- unresolved validation blockers
- projected gross payroll and burden variance vs prior periods
- projected tax deposit obligations

### 12.2 Missing timecard alerts
1. Detect assigned employees with expected work but no submitted/approved time.
2. Escalation cadence:
- reminder to supervisor
- escalation to payroll manager
- optional escalation to PM leadership

### 12.3 Overtime threshold warnings
1. Alert at configurable threshold (default 38h) before overtime trigger.
2. Predict weighted-average overtime exposure for multi-rate workers.
3. Suggest labor reallocation scenarios where policy allows.

### 12.4 Other predictive signals
- likely certified payroll correction risk (classification/rate anomalies)
- likely tax deposit shortfall by due date
- likely union remittance variance vs historical baseline

---

## 13) Security, Controls, and Audit

1. All endpoints require `[Authorize]` with payroll-specific scopes.
2. Segregation of duties:
- preparer cannot approve/post same payroll batch by default.
- filing/payment execution requires elevated finance role.
3. Immutable audit trail for rate resolution, overrides, approvals, and filing/payment actions.
4. Soft-delete policy applies to operational records; financial postings require void/reversal semantics.
5. Period lock integration prevents posting into closed accounting periods without controlled reopen.

---

## 14) API Surface (Summary)

### 14.1 Payroll processing
- `POST /api/payroll/batches`
- `POST /api/payroll/batches/{id}/collect-time`
- `POST /api/payroll/batches/{id}/validate`
- `POST /api/payroll/batches/{id}/calculate`
- `POST /api/payroll/batches/{id}/submit-approval`
- `POST /api/payroll/batches/{id}/approve`
- `POST /api/payroll/batches/{id}/distribute`
- `POST /api/payroll/batches/{id}/post`

### 14.2 Certified payroll
- `POST /api/payroll/certified-payroll/weeks/generate`
- `POST /api/payroll/certified-payroll/weeks/{id}/validate`
- `GET /api/payroll/certified-payroll/weeks/{id}/wh347?format=pdf|json|xml`
- `POST /api/payroll/certified-payroll/weeks/{id}/submit`

### 14.3 Tax, union, and WC
- `GET /api/payroll/taxes/deposits`
- `POST /api/payroll/taxes/deposits/{id}/mark-paid`
- `POST /api/payroll/unions/remittances/generate`
- `GET /api/payroll/workers-comp/summary`

---

## 15) Implementation Phases

1. **Phase 1: Payroll core + time integration**
- `PayrollBatch`, `PayrollDetail`, validation engine, collect/calculate/approve/post workflow.

2. **Phase 2: Prevailing wage + certified payroll**
- wage determination/rate tables, project classification mapping, WH-347 generation/validation.

3. **Phase 3: Fringe, union, and workers' comp**
- fringe rules, union remittance outputs, WC class/rate tracking and reports.

4. **Phase 4: Multi-state tax + deposit scheduling**
- tax jurisdiction/rate engine, deposit obligations, 941/state/local filing datasets.

5. **Phase 5: AI + predictive readiness**
- discrepancy detection, draft generation, readiness and overtime prediction dashboards.

---

## 16) Acceptance Criteria

1. Payroll manager can process a pay period from approved time to posted batch with traceability.
2. Certified payroll WH-347 can be generated weekly for prevailing wage projects without manual re-entry.
3. Prevailing wage below-rate scenarios are blocked or hard-flagged per policy.
4. Union fringe and remittance reports are generated by local/classification/month.
5. Multi-state withholding logic correctly allocates taxable wages by jurisdiction.
6. Workers' comp payroll summary by class/state is auditor-ready.
7. Tax deposit obligations and due dates are generated and reconciled to payments.
8. Time corrections after batch calculation produce controlled delta adjustments.
9. AI flags rate/tax anomalies with human approval controls for high-risk actions.
10. Predictive readiness dashboard shows missing timecards, overtime risk, and projected deposits before close.

---

## 17) Open Decisions

1. Module boundary: standalone `Pitbull.Payroll` vs payroll implementation inside `Pitbull.TimeTracking`.
2. Filing strategy: native e-file support vs integration with third-party payroll tax filing providers.
3. Certified payroll submission integrations: direct agency portals vs export-only in first release.
4. How to model complex union CBA edge cases (ratio enforcement, zone pay, shift differentials) in v1 rules engine.
5. Whether payroll disbursement execution is owned by payroll module or delegated to AP cash management.
