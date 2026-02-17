# Phase 2 PR Review Checklist (Employee Onboarding + Payment Applications)

**Date:** 2026-02-17  
**Purpose:** Review checklist for Claude Code PR against `EMPLOYEE-ONBOARDING.md` and `PAYMENT-APPLICATIONS.md`.

---

## Review Setup

- [ ] Read `docs/plans/EMPLOYEE-ONBOARDING.md` and `docs/plans/PAYMENT-APPLICATIONS.md` before code review.
- [ ] Confirm PR scope maps to planned phases and does not include unrelated architectural drift.
- [ ] Confirm no MediatR usage was added in controllers (direct service injection only).

---

## Architecture and Pattern Compliance

### Controller Pattern (`ProjectsController` reference)

- [ ] New controllers use `[ApiController]`, `[Produces("application/json")]`, `[EnableRateLimiting("api")]`.
- [ ] New endpoints require `[Authorize]` unless explicitly justified.
- [ ] Routes are explicit and REST-consistent with existing patterns.
- [ ] Controllers delegate business logic to services, not embedded in controller methods.

### Service Pattern (`ProjectService` reference)

- [ ] Services return `Result<T>` / `Result` with clear error codes.
- [ ] Services include logging on failures and key transitions.
- [ ] Validation happens via validators/service layer, not ad hoc scattered checks.

### Entity Pattern (`BaseEntity` reference)

- [ ] New business entities inherit `BaseEntity`.
- [ ] Company-scoped entities implement `ICompanyScoped` and include `CompanyId`.
- [ ] Soft-delete fields (`IsDeleted`, `DeletedAt`, `DeletedBy`) are used for deletes (no hard deletes for business entities).

### DbContext / Registration (`PitbullDbContext` reference)

- [ ] New entity configurations are discoverable via registered module assemblies.
- [ ] Company-scoped entities are receiving company filter/index behavior.
- [ ] `Program.cs` includes required module registrations:
- [ ] `PitbullDbContext.RegisterModuleAssembly(...)`
- [ ] `AddPitbullModule<...>()`
- [ ] `AddPitbullModuleServices<...>()`

---

## Feature-Specific Functional Checks

### Employee Onboarding

- [ ] Multi-step wizard backend endpoints exist for create/get/list/save-step/submit/approve/reject/complete.
- [ ] Contractor-type profile behavior is settings-driven (no hardcoded Civil/Electrical/Mechanical branching in controllers).
- [ ] CSV import supports validate-only and commit modes.
- [ ] Import error reporting returns row/column/code/message and downloadable error CSV.
- [ ] `EmployeeOnboardingSettings` is company-scoped and fully wired in API + persistence.

### Payment Applications (AIA G702/G703)

- [ ] Payment apps bill against SOV (`schedule_of_values` / `sov_line_items`) line-item snapshots.
- [ ] Line-item formulas are correct (previous + current + stored, percent complete, balance, retainage).
- [ ] Lifecycle supports `Draft -> Submitted -> Reviewed -> Approved -> Paid` with timestamps/audit.
- [ ] Retainage default comes from company settings and supports release logic controls.
- [ ] Dual-book outputs (GAAP + Bonus/Job Cost) are present and selectable.
- [ ] PDF export endpoints exist and generate G702/G703 matching expected structure.

---

## Critical Risk Checks (Must Pass)

### 1) Backend/Frontend Type Mismatch

- [ ] Every new/changed backend DTO has a matching frontend TS interface.
- [ ] Optional/nullable fields align exactly (`string?` vs `string | null | undefined`).
- [ ] Enum numeric/string shape is consistent between API and UI usage.
- [ ] Date types are consistent (`DateOnly`/`DateTime` serialized forms expected by UI).

Suggested checks:

```bash
rg -n "record .*Dto|record .*Request|record .*Response" src/Modules src/Pitbull.Api
rg -n "interface .*|type .*" src/Pitbull.Web/pitbull-web/src/lib src/Pitbull.Web/pitbull-web/src/types
```

### 2) Missing Soft-Delete Filters

- [ ] All queries on `BaseEntity` types include `!IsDeleted` (or rely on verified global query filters intentionally).
- [ ] Deletes use soft-delete unless explicitly approved otherwise.
- [ ] Tests cover not-found behavior for deleted records.

Suggested checks:

```bash
rg -n "FirstOrDefaultAsync\(|Where\(|AnyAsync\(|ToListAsync\(" src/Modules src/Pitbull.Api | rg -v "!IsDeleted|IsDeleted == false|HasQueryFilter"
rg -n "Remove\(|RemoveRange\(" src/Modules src/Pitbull.Api
```

### 3) Missing `[Authorize]`

- [ ] All new controller classes or endpoints are protected with `[Authorize]`.
- [ ] Any `[AllowAnonymous]` endpoint has explicit justification and rate limiting.

Suggested checks:

```bash
rg -n "class .*Controller|\[Http(Get|Post|Put|Patch|Delete)" src/Pitbull.Api/Controllers
rg -n "\[AllowAnonymous\]|\[Authorize" src/Pitbull.Api/Controllers
```

### 4) Settings Entity Not Registered

- [ ] Settings entities are included in EF model via module assembly configuration classes.
- [ ] New settings services are registered in `Program.cs` DI.
- [ ] Settings endpoints resolve active company context correctly.

Suggested checks:

```bash
rg -n "EmployeeOnboardingSettings|PaymentApplicationSettings" src
rg -n "AddScoped<.*Settings" src/Pitbull.Api/Program.cs
```

### 5) Dockerfile COPY Lines Missing

- [ ] If new module/project was added, `src/Pitbull.Api/Dockerfile` contains corresponding `.csproj` `COPY` line.
- [ ] Build stage still restores/publishes successfully with updated project set.

Suggested checks:

```bash
rg -n "COPY src/Modules/.+\.csproj" src/Pitbull.Api/Dockerfile
```

### 6) Migration Safety

- [ ] No `RenameColumn` / `RenameTable` usage.
- [ ] No dangerous raw SQL (`DROP TABLE`, `TRUNCATE`).
- [ ] Backfills with bounded varchar use `LEFT(value, max_length)`.
- [ ] Raw SQL aliases in PostgreSQL are quoted (`AS "Value"`).
- [ ] RLS SQL uses PascalCase column names (`"TenantId"`, etc.).

Suggested checks:

```bash
rg -n "RenameColumn|RenameTable|DROP TABLE|TRUNCATE" src/Pitbull.Api/Migrations
rg -n "migrationBuilder\.Sql\(" src/Pitbull.Api/Migrations
```

---

## Testing and CI Checklist

- [ ] Unit tests added/updated for validators, services, status transitions, and calculations.
- [ ] Integration tests added for endpoints, tenant isolation, and soft-delete behavior.
- [ ] Frontend build and lint pass for new onboarding/payment pages.
- [ ] Backend build and tests pass.

Validation commands:

```bash
dotnet build Pitbull.sln --configuration Release
dotnet test tests/Pitbull.Tests.Unit --configuration Release --verbosity normal
dotnet test tests/Pitbull.Tests.Integration --configuration Release --verbosity normal
cd src/Pitbull.Web/pitbull-web && npm run build && npm run lint
```

---

## PR Exit Criteria

- [ ] No P0/P1 findings in security, data integrity, or accounting math.
- [ ] DTO contracts are consistent end-to-end.
- [ ] Settings are fully configurable, company-scoped, and not hardcoded by contractor type.
- [ ] Migrations are safe and deployable.
- [ ] Production Docker build path remains valid.
