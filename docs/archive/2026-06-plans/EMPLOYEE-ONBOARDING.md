# Employee Onboarding — Design Spec

**Author:** Codex (for Pitbull team)
**Date:** 2026-02-17
**Status:** Ready for implementation
**Target Module:** `Pitbull.TimeTracking` (with company settings integration)

---

## Problem

Current employee creation is a single-step CRUD flow. Construction ERP onboarding requires structured intake across HR, safety, payroll compliance, and prevailing wage/certified payroll rules. Missing or inconsistent onboarding data creates payroll risk, safety exposure, and Davis-Bacon non-compliance.

## Goals

1. Add a multi-step onboarding wizard for construction-specific employee intake.
2. Add CSV bulk import with row-level validation and downloadable error reporting.
3. Add a company-scoped `EmployeeOnboardingSettings` model to make steps/fields configurable by contractor type (Civil, Electrical, Mechanical, etc.) without hardcoding.
4. Integrate onboarding with existing `Employee` entity and `/api/employees` workflows.
5. Support role-specific workflows and approvals for HR Manager, Safety Manager, and Payroll Specialist.

## Non-Goals

- No e-signature/legal document execution engine in v1.
- No external payroll provider sync in v1 (ADP/Paychex/etc).
- No OCR/AI document parsing in v1.

---

## Personas and Workflow Requirements

### HR Manager

- Needs one guided process for personal profile, emergency contacts, employment metadata, and policy acknowledgements.
- Needs configurable required fields by contractor type and union context.
- Needs onboarding completeness tracking and status (Draft, Submitted, Approved, Rejected).

### Safety Manager

- Needs certification tracking (OSHA-10/30, CDL class, welding certs, expirations, attachments).
- Needs gating rules: field deployment blocked if required safety certs missing/expired.
- Needs visibility into upcoming expirations and missing certs before first assignment.

### Payroll Specialist

- Needs W-4 data completeness, I-9 verification metadata, union local/fringe setup, prevailing wage classification mapping.
- Needs Davis-Bacon/certified payroll flags and work classification readiness.
- Needs error-proof bulk intake with precise row/column validation output.

---

## Functional Scope

## 1. Multi-Step Onboarding Wizard

### Step Definitions (default baseline)

1. `PersonalInfo`
- Employee number, legal name, DOB (optional toggle), email, phone, address, hire date, home company, classification, supervisor.

2. `EmergencyContacts`
- One or more contacts with relationship, phone, and optional address.

3. `TaxCompliance`
- W-4 metadata (filing status, additional withholding), I-9 status/dates, certified payroll participation, Davis-Bacon flags, EEO/job category toggles.

4. `Certifications`
- OSHA, CDL, welding, equipment licenses, and custom certs with issue/expiry dates and document references.

5. `UnionPrevailingWage`
- Union affiliation, local, member ID, apprenticeship level, prevailing wage classification(s), effective date ranges.

6. `ReviewSubmit`
- Completeness check, warnings/errors, submit for approval.

### Wizard Behavior

- Step sequence and field requirement are driven by settings profile (contractor type + company overrides).
- Save-as-draft at each step.
- Validation runs on step save and final submit.
- Final submit creates/updates `Employee` record and linked onboarding records atomically.
- Soft-delete rules apply to all onboarding records (`IsDeleted`, `DeletedAt`, `DeletedBy`).

## 2. CSV Bulk Import

### Capabilities

- Upload CSV file and map columns to canonical onboarding fields.
- Dry-run validation mode before commit.
- Commit mode creates onboarding applications (or directly creates employees when configured).

### Validation Rules

- Structural: required columns present for selected import profile.
- Field-level: datatype, enum, max length, date ranges, numeric bounds.
- Referential: supervisor exists, union local exists (if required), prevailing wage class exists (if required).
- Business: duplicate employee number/email checks (tenant + soft-delete aware), cert expiry after issue date, I-9 completion date logic.

### Error Reporting

- API returns import summary + row errors.
- UI allows downloading error CSV.

Error shape:

```json
{
  "importId": "guid",
  "status": "ValidationFailed",
  "summary": {
    "totalRows": 200,
    "validRows": 173,
    "invalidRows": 27,
    "warnings": 14
  },
  "errors": [
    {
      "rowNumber": 18,
      "column": "w4FilingStatus",
      "code": "INVALID_ENUM",
      "message": "Value must be Single, MarriedFilingJointly, or HeadOfHousehold"
    }
  ]
}
```

## 3. EmployeeOnboardingSettings (Company-Scoped)

### New Entity

`EmployeeOnboardingSettings : BaseEntity, ICompanyScoped`

Core fields:

- `CompanyId: Guid`
- `Enabled: bool`
- `DefaultContractorType: ContractorType`
- `RequireApprovalWorkflow: bool`
- `AutoCreateEmployeeOnSubmit: bool`
- `AllowBulkImportCreate: bool`
- `ActiveProfileJson: jsonb` (step/field config)
- `Version: int`

### Supporting Config Entities

- `OnboardingProfile` (company-scoped): profile name + contractor type + active flag.
- `OnboardingStepConfig` (company-scoped): step key, order, enabled, required, role owner.
- `OnboardingFieldConfig` (company-scoped): field key, label override, required, visible, validation rule JSON.

### Contractor Type Configuration

Use configurable profiles, not hardcoded field behavior.

`ContractorType` enum seed values:

- `Civil`
- `Electrical`
- `Mechanical`
- `Plumbing`
- `Utility`
- `GeneralBuilding`
- `Specialty`
- `Custom`

Each profile determines:

- enabled steps,
- required fields,
- allowed values (for classification/cert types),
- approval requirements by role.

Example: Electrical profile can require journeyman license + OSHA-10; Mechanical can require welding cert + rigging cert; Civil can require heavy equipment qualifications.

---

## Domain Model and Data Design

## New Entities (proposed)

All entities inherit `BaseEntity`; company-scoped entities implement `ICompanyScoped`.

1. `EmployeeOnboardingApplication` (company-scoped)
- `Id, TenantId, CompanyId`
- `EmployeeId?` (null until linked/created)
- `ContractorType`
- `Status` (`Draft|Submitted|HrApproved|SafetyApproved|PayrollApproved|Completed|Rejected`)
- `CurrentStepKey`
- `ProfileId`
- `SubmittedAt, CompletedAt`

2. `EmployeeEmergencyContact` (company-scoped)
- `EmployeeId` or `OnboardingApplicationId`
- `Name, Relationship, Phone, Email, Address, IsPrimary`

3. `EmployeeTaxCompliance` (company-scoped)
- `EmployeeId`/`OnboardingApplicationId`
- `W4FilingStatus, W4AdditionalWithholding, W4Exempt`
- `I9Status, I9Section1Date, I9Section2Date, I9VerifiedBy`
- `CertifiedPayrollRequired, DavisBaconApplicable`
- `PayrollNotes`

4. `EmployeeCertification` (company-scoped)
- `EmployeeId`/`OnboardingApplicationId`
- `CertificationType, CertificationNumber, IssuedDate, ExpiresDate`
- `IssuingAuthority, DocumentId?, VerificationStatus`

5. `EmployeeUnionAffiliation` (company-scoped)
- `EmployeeId`/`OnboardingApplicationId`
- `UnionName, LocalNumber, MemberId, Craft, ApprenticeLevel`
- `EffectiveDate, EndDate`

6. `EmployeePrevailingWageClass` (company-scoped)
- `EmployeeId`/`OnboardingApplicationId`
- `Jurisdiction, ClassificationCode, ClassificationName`
- `EffectiveDate, EndDate, Notes`

7. `EmployeeOnboardingImport` (company-scoped)
- `Id, FileName, Status, TotalRows, ValidRows, InvalidRows`
- `StartedAt, CompletedAt, ErrorReportStoragePath`

8. `EmployeeOnboardingImportRowError` (company-scoped)
- `ImportId, RowNumber, ColumnName, ErrorCode, ErrorMessage`

## Integration with Existing `Employee`

- Keep `Employee` as system-of-record for active employee master data.
- Onboarding application stores pre-hire/in-progress data.
- On completion, map approved onboarding fields into `Employee` (and related compliance/cert tables).
- Add nullable `OnboardingStatus` and `OnboardingCompletedAt` to `Employee` only if needed for list filtering; avoid duplicating full onboarding payload.

---

## Backend API Design

All endpoints require `[Authorize]` unless explicitly stated.

## Controller 1: `EmployeeOnboardingController`

Route base: `api/employee-onboarding`

### Endpoints

1. `POST /api/employee-onboarding/applications`
- Create onboarding application draft.

Request DTO:

```csharp
public sealed record CreateOnboardingApplicationRequest(
    Guid CompanyId,
    ContractorType ContractorType,
    Guid? EmployeeId,
    Guid? ProfileId,
    string? Notes
);
```

Response DTO:

```csharp
public sealed record OnboardingApplicationDto(
    Guid Id,
    Guid CompanyId,
    Guid? EmployeeId,
    ContractorType ContractorType,
    string Status,
    string CurrentStepKey,
    Guid ProfileId,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);
```

2. `GET /api/employee-onboarding/applications/{id:guid}`
- Get full application payload (step data + validation state).

3. `GET /api/employee-onboarding/applications`
- List with paging/filtering.

Query params:
- `status`, `companyId`, `contractorType`, `search`, `page`, `pageSize`.

Response:
- `PagedResult<OnboardingApplicationListItemDto>`.

4. `PUT /api/employee-onboarding/applications/{id:guid}/steps/{stepKey}`
- Save one step.

Request DTO (envelope + per-step payload):

```csharp
public sealed record SaveOnboardingStepRequest(
    string StepKey,
    JsonElement Payload,
    bool MarkStepComplete
);
```

Response DTO:

```csharp
public sealed record SaveOnboardingStepResponse(
    Guid ApplicationId,
    string StepKey,
    bool IsValid,
    IReadOnlyList<ValidationMessageDto> Errors,
    IReadOnlyList<ValidationMessageDto> Warnings,
    string NextStepKey
);
```

5. `POST /api/employee-onboarding/applications/{id:guid}/submit`
- Submit application for approvals.

6. `POST /api/employee-onboarding/applications/{id:guid}/approve`
- Approve by role owner (`HR|Safety|Payroll`).

Request DTO:

```csharp
public sealed record ApproveOnboardingRequest(
    string Role, // HR, Safety, Payroll
    string? Notes
);
```

7. `POST /api/employee-onboarding/applications/{id:guid}/reject`

8. `POST /api/employee-onboarding/applications/{id:guid}/complete`
- Finalize and create/update employee + linked records.

9. `DELETE /api/employee-onboarding/applications/{id:guid}`
- Soft-delete application.

## Controller 2: `EmployeeOnboardingImportController`

Route base: `api/employee-onboarding/imports`

1. `POST /api/employee-onboarding/imports/validate`
- multipart upload, validate-only.

2. `POST /api/employee-onboarding/imports`
- multipart upload, validate + commit.

3. `GET /api/employee-onboarding/imports/{id:guid}`
- Import status and summary.

4. `GET /api/employee-onboarding/imports/{id:guid}/errors`
- Paged row errors.

5. `GET /api/employee-onboarding/imports/{id:guid}/errors.csv`
- Download error report.

## Controller 3: `EmployeeOnboardingSettingsController`

Route base: `api/companies/settings/employee-onboarding`

Follow TimecardSettings pattern (company-scoped).

1. `GET /api/companies/settings/employee-onboarding`
- Returns effective settings and profiles.

2. `PUT /api/companies/settings/employee-onboarding`
- Replace settings.

Request DTO:

```csharp
public sealed record UpdateEmployeeOnboardingSettingsRequest(
    bool Enabled,
    ContractorType DefaultContractorType,
    bool RequireApprovalWorkflow,
    bool AutoCreateEmployeeOnSubmit,
    bool AllowBulkImportCreate,
    IReadOnlyList<OnboardingProfileDto> Profiles
);
```

3. `POST /api/companies/settings/employee-onboarding/profiles`
4. `PUT /api/companies/settings/employee-onboarding/profiles/{profileId:guid}`
5. `DELETE /api/companies/settings/employee-onboarding/profiles/{profileId:guid}` (soft-delete)

## Service Interfaces

- `IEmployeeOnboardingService`
- `IEmployeeOnboardingImportService`
- `IEmployeeOnboardingSettingsService`
- Existing `IEmployeeService` remains authoritative for core employee master operations.

---

## Frontend Design

## 1. Onboarding Wizard UI

Path: `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/employees/onboarding/[id]/page.tsx`

Components:

- `OnboardingWizardShell`
- `StepPersonalInfoForm`
- `StepEmergencyContactsForm`
- `StepTaxComplianceForm`
- `StepCertificationsForm`
- `StepUnionPrevailingWageForm`
- `StepReviewSubmit`
- `OnboardingValidationSummary`

Behavior:

- Stepper driven by server-provided step config.
- Auto-save and explicit save button.
- Block navigation on hard validation errors; allow warnings with confirmation.
- Role-based action buttons (Approve/Reject visible by role).

## 2. CSV Import UI

Path: `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/employees/onboarding/import/page.tsx`

Components:

- `OnboardingImportUploader`
- `ColumnMappingEditor`
- `ImportValidationResults`
- `ImportErrorTable`

Features:

- Download template CSV by contractor profile.
- Validate-only then commit.
- Show row-level errors and export error CSV.

## 3. Settings Admin UI

Path: `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/admin/employee-onboarding/page.tsx`

Components:

- `EmployeeOnboardingSettingsForm`
- `ContractorProfileTabs`
- `StepConfigEditor`
- `FieldConfigEditor`
- `PreviewWizardForProfile`

Features:

- Configure profiles by contractor type.
- Toggle required fields/steps.
- Assign step owner role (HR/Safety/Payroll).
- Keep defaults + allow customer overrides.

---

## Validation and Compliance Rules (v1)

- `!IsDeleted` enforced on all onboarding queries.
- Employee uniqueness: (`TenantId`, `EmployeeNumber`) and normalized email checks.
- I-9:
- section date order must be valid.
- if marked verified, verifier required.
- Davis-Bacon/certified payroll:
- if enabled, at least one prevailing wage classification required.
- Union:
- if union-affiliated, union name + local required.
- Certifications:
- expiry must be after issue date.
- required certs derived from active profile.

---

## Security and Authorization

- `[Authorize]` on all onboarding endpoints.
- Role guidance:
- Create/edit draft: `Admin,Manager,HR`.
- Safety approvals: `Admin,SafetyManager`.
- Payroll approvals: `Admin,Payroll`.
- Settings edit: `Admin` only.
- Do not expose stack traces in API responses.
- Audit log entries for submit/approve/reject/complete/import actions.

---

## Reporting and Downstream Effects

On completion, data should be immediately available to:

- Employee list/details (`/api/employees`),
- certified payroll and labor reports,
- safety compliance dashboards,
- staffing/assignment flows.

Planned reporting views:

- onboarding pipeline by status and days aging,
- missing certification report,
- pending payroll compliance report,
- prevailing wage readiness by project/jurisdiction.

---

## Implementation Plan

## Phase 1: Data + Settings

1. Add entities/configurations/migrations for onboarding + settings + imports.
2. Add settings endpoints/controller.
3. Seed default profiles for Civil/Electrical/Mechanical/GeneralBuilding.

## Phase 2: Wizard API + UI

1. Add onboarding application endpoints and service.
2. Implement wizard pages and step forms.
3. Add HR/Safety/Payroll approvals.

## Phase 3: CSV Import

1. Add import validate/commit pipeline.
2. Add import UI + error CSV download.
3. Add integration tests for validation edge cases.

## Phase 4: Hardening

1. Add unit/integration tests for soft-delete and role auth.
2. Add concurrency handling for simultaneous approvals.
3. Add performance checks on bulk imports.

---

## Testing Strategy

### Unit Tests

- step validator tests per contractor profile.
- settings profile resolution tests.
- import parser/validator tests.
- employee mapping completion tests.

### Integration Tests

- onboarding CRUD + approvals with tenant isolation.
- settings CRUD company scoping.
- import validate/commit and error CSV generation.
- authorization matrix for HR/Safety/Payroll/Admin.
- soft-delete 404 behavior.

### Frontend Tests

- wizard step transitions + validation rendering.
- import flow (upload -> validate -> commit).
- settings editor saves and reloads profile configs.

---

## Open Decisions

1. Should onboarding completion be required before first time entry (`hard block`) or configurable warning (`soft gate`)? Recommended: setting toggle per company.
2. Should certified payroll fields live only in onboarding tables or also denormalize key fields onto `Employee` for fast reporting? Recommended: keep canonical in dedicated tables, expose query projections.
3. Should union and prevailing wage classifications support many active records simultaneously per employee? Recommended: yes, effective-date based.

---

## Acceptance Criteria

1. Company admin can configure onboarding steps/fields by contractor type profile without code changes.
2. HR can onboard one employee end-to-end with required step validations.
3. Safety can enforce required certification presence/validity before completion.
4. Payroll can verify tax/compliance data, including Davis-Bacon and prevailing wage classifications.
5. CSV import supports validate-only and commit, with downloadable row-level error report.
6. Completed onboarding creates/updates employee and related records under tenant/company scoping.
7. All onboarding data paths honor soft-delete and authorization requirements.
