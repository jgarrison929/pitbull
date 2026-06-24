# Test Coverage Gaps Review (Feb 21, 2026)

## Scope
Reviewed unit tests under `tests/Pitbull.Tests.Unit/` and compared them to concrete `*Service.cs` implementations in `src/Modules/`.

Directory structure reviewed:
- `tests/Pitbull.Tests.Unit/Api`
- `tests/Pitbull.Tests.Unit/Architecture`
- `tests/Pitbull.Tests.Unit/BankReconciliation`
- `tests/Pitbull.Tests.Unit/Billing`
- `tests/Pitbull.Tests.Unit/Configuration`
- `tests/Pitbull.Tests.Unit/Consumers`
- `tests/Pitbull.Tests.Unit/Contracts`
- `tests/Pitbull.Tests.Unit/Domain`
- `tests/Pitbull.Tests.Unit/Handlers`
- `tests/Pitbull.Tests.Unit/Middleware`
- `tests/Pitbull.Tests.Unit/Modules`
- `tests/Pitbull.Tests.Unit/MultiCompany`
- `tests/Pitbull.Tests.Unit/Security`
- `tests/Pitbull.Tests.Unit/Services`
- `tests/Pitbull.Tests.Unit/Stability`
- `tests/Pitbull.Tests.Unit/Validation`

## Method
- Enumerated concrete service classes from `src/Modules/**/**Service.cs` (excluding `I*Service.cs`).
- Mapped service names to unit test files and direct service references.
- Prioritized findings for:
  - money movement/accounting workflows
  - status transitions
  - security-sensitive operations

High-level count:
- Concrete services found: `52`
- Services with no matching `*Tests.cs` by name: `18`

## Findings (Ordered by Severity)

### 1) Critical: Zero Unit Coverage on High-Risk Services

1. `src/Modules/Pitbull.Contracts/Services/PaymentApplicationService.cs`
Evidence:
- No direct unit tests reference `PaymentApplicationService` (controller uses mocked interface only: `tests/Pitbull.Tests.Unit/Api/PaymentApplicationsControllerTests.cs:18`).
- High-risk status and money transitions implemented here: `SubmitAsync`/`ReviewAsync`/`ApproveAsync`/`RejectAsync`/`MarkPaidAsync` (`src/Modules/Pitbull.Contracts/Services/PaymentApplicationService.cs:86`, `src/Modules/Pitbull.Contracts/Services/PaymentApplicationService.cs:120`, `src/Modules/Pitbull.Contracts/Services/PaymentApplicationService.cs:142`, `src/Modules/Pitbull.Contracts/Services/PaymentApplicationService.cs:170`, `src/Modules/Pitbull.Contracts/Services/PaymentApplicationService.cs:198`).

2. `src/Modules/Pitbull.SystemAdmin/Services/ApiKeyService.cs`
Evidence:
- No unit test references to `ApiKeyService`.
- Security-critical key generation/hashing/revocation/delete flows: `GenerateApiKey`, `HashKey`, `RevokeKeyAsync`, `DeleteKeyAsync` (`src/Modules/Pitbull.SystemAdmin/Services/ApiKeyService.cs:59`, `src/Modules/Pitbull.SystemAdmin/Services/ApiKeyService.cs:76`, `src/Modules/Pitbull.SystemAdmin/Services/ApiKeyService.cs:89`, `src/Modules/Pitbull.SystemAdmin/Services/ApiKeyService.cs:100`).

3. `src/Modules/Pitbull.TimeTracking/Services/EmployeeOnboardingService.cs`
Evidence:
- No unit test references to `EmployeeOnboardingService`.
- Status transitions are central: `CompleteOnboardingAsync` + onboarding progression (`src/Modules/Pitbull.TimeTracking/Services/EmployeeOnboardingService.cs:53`, `src/Modules/Pitbull.TimeTracking/Services/EmployeeOnboardingService.cs:349`).

4. `src/Modules/Pitbull.TimeTracking/Services/EmployeeService.cs`
Evidence:
- No direct unit test coverage of concrete `EmployeeService` (controller tests mock interface: `tests/Pitbull.Tests.Unit/Api/EmployeesControllerTests.cs:20`).
- Includes compensation/statistics logic and raw SQL path in `GetEmployeeStatsAsync` (`src/Modules/Pitbull.TimeTracking/Services/EmployeeService.cs:100`).

5. `src/Modules/Pitbull.AI/Services/AiUsageService.cs`
Evidence:
- No unit tests reference concrete `AiUsageService`.
- Tracks estimated AI costs and usage aggregation (`GetUsageSummaryAsync`, `GetUsageByUserAsync`) with financial reporting implications.

6. `src/Modules/Pitbull.SystemAdmin/Services/TenantSettingsService.cs`
Evidence:
- No unit tests reference `TenantSettingsService`.
- Tenant-wide operational/security toggles are set in `UpsertSettingsAsync` (module enablement flags).

### 2) High: Minimal / Indirect-Only Coverage for Money + State Services

1. `src/Modules/Pitbull.Billing/Services/BillingPeriodService.cs`
Evidence:
- Referenced only via controller composition (`tests/Pitbull.Tests.Unit/Api/BillingPeriodsControllerTests.cs:32`).
- No dedicated `BillingPeriodServiceTests` for overlap validation/status edits/deletes.

2. `src/Modules/Pitbull.Billing/Services/CustomerService.cs`
Evidence:
- Service is instantiated in controller tests only (`tests/Pitbull.Tests.Unit/Api/CustomersControllerTests.cs:31`).
- No dedicated service-level tests for duplicate-code/concurrency/data integrity paths.

3. `src/Modules/Pitbull.Billing/Services/VendorService.cs`
Evidence:
- Service is instantiated in controller tests only (`tests/Pitbull.Tests.Unit/Api/VendorsControllerTests.cs:31`).
- No dedicated service-level tests for duplicate-code/concurrency/error handling.

4. `src/Modules/Pitbull.Billing/Services/WageDeterminationService.cs`
Evidence:
- No dedicated service test file.
- Concrete usage found mostly in `tests/Pitbull.Tests.Unit/Stability/MediumFixesTests.cs` (`:328`, `:357`, `:386`), while API tests mock the interface (`tests/Pitbull.Tests.Unit/Api/WageDeterminationsControllerTests.cs:15`).

5. `src/Modules/Pitbull.Billing/Services/LienWaiverService.cs`
Evidence:
- No dedicated `LienWaiverServiceTests`.
- Indirect coverage via controller and a stability test (`tests/Pitbull.Tests.Unit/Api/LienWaiversControllerTests.cs:33`, `tests/Pitbull.Tests.Unit/Stability/MediumFixesTests.cs:604`).
- Service contains critical state transitions `ApproveAsync`/`RejectAsync`/`MarkReceivedAsync` (`src/Modules/Pitbull.Billing/Services/LienWaiverService.cs:158`, `src/Modules/Pitbull.Billing/Services/LienWaiverService.cs:186`, `src/Modules/Pitbull.Billing/Services/LienWaiverService.cs:217`).

6. `src/Modules/Pitbull.Billing/Services/OwnerContractService.cs`
Evidence:
- No dedicated `OwnerContractServiceTests`.
- Current coverage is spread across controller + stability tests (`tests/Pitbull.Tests.Unit/Api/OwnerContractsControllerTests.cs:33`, `tests/Pitbull.Tests.Unit/Stability/MediumFixesTests.cs:188`).
- Money-affecting create/update/delete paths in service (`src/Modules/Pitbull.Billing/Services/OwnerContractService.cs:45`, `src/Modules/Pitbull.Billing/Services/OwnerContractService.cs:86`, `src/Modules/Pitbull.Billing/Services/OwnerContractService.cs:127`).

7. `src/Modules/Pitbull.Core/Features/CostCode/CostCodeService.cs`
Evidence:
- No dedicated `CostCodeServiceTests`; primarily instantiated through API controller tests (`tests/Pitbull.Tests.Unit/Api/CostCodesControllerTests.cs:33`).
- Financial categorization integrity impact for create/update/delete operations (`src/Modules/Pitbull.Core/Features/CostCode/CostCodeService.cs:87`, `src/Modules/Pitbull.Core/Features/CostCode/CostCodeService.cs:129`, `src/Modules/Pitbull.Core/Features/CostCode/CostCodeService.cs:187`).

### 3) Medium: Security/Isolation-Adjacent Services with Zero Coverage

1. `src/Modules/Pitbull.Documents/Services/FileStorageService.cs`
Evidence:
- No unit tests reference `FileStorageService`.
- Handles tenant-scoped file pathing and persistence; lacks tests for path safety and tenant folder isolation.

2. `src/Modules/Pitbull.Notifications/Services/NotificationService.cs`
Evidence:
- No direct unit tests for concrete service; only interface mocks in other tests.
- Contains user-specific read/unread/delete status operations.

## Recommended First Test Wave

1. Add `tests/Pitbull.Tests.Unit/Modules/Contracts/PaymentApplicationServiceTests.cs`.
Target:
- All valid/invalid state transitions.
- Settings-driven behavior (`RequireSignedSubcontract`, approval workflow toggles, lien-waiver gate).
- Monetary total recomputation and approved amount behavior.

2. Add `tests/Pitbull.Tests.Unit/Modules/SystemAdmin/ApiKeyServiceTests.cs`.
Target:
- Key format entropy assumptions (prefix, length, uniqueness across samples).
- Hashing behavior (never stores plaintext key hash mismatch).
- Revoke/delete idempotency and invalid-state handling.

3. Add `tests/Pitbull.Tests.Unit/Modules/TimeTracking/EmployeeOnboardingServiceTests.cs`.
Target:
- Complete/reopen/progress transitions.
- Validation requirements around tax/emergency contacts and state recalculation.

4. Add `tests/Pitbull.Tests.Unit/Modules/TimeTracking/EmployeeServiceTests.cs`.
Target:
- Earnings and hours aggregation in `GetEmployeeStatsAsync`.
- Employee number generation and update/delete behavior with soft-delete expectations.

5. Add dedicated tests for `BillingPeriodService`, `VendorService`, `CustomerService`, and `LienWaiverService` to move beyond controller-only/medium-fix coverage.

## Notes
- This review is based on static test-to-service mapping and symbol references in the unit test project.
- It identifies likely coverage gaps; it does not measure runtime branch/line coverage percentages.
