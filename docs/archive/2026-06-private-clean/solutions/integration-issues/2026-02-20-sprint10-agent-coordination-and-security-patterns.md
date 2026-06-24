---
title: "Sprint 10 — Agent Coordination, Security Patterns, and Encryption"
date: 2026-02-20
category: integration-issues
tags:
  - agent-coordination
  - type-drift
  - static-registration
  - encryption
  - public-endpoints
  - security-hardening
  - migration-consolidation
modules_affected:
  - Pitbull.Core
  - Pitbull.Billing
  - Pitbull.TimeTracking
  - pitbull-web
severity: medium
component:
  - DashboardPreference
  - VendorPortalToken
  - IFieldEncryptionService
  - WidgetConfig
---

# Sprint 10 — Agent Coordination, Security Patterns, and Encryption

## Context

Sprint 10 built three features using a 3-agent team (backend-architect, infra-engineer, security-engineer):
1. **Dashboard Customization (P6)** — DashboardPreference entity, 11 widget components, role templates
2. **Vendor Portal for Lien Waivers (C5)** — Token-based public access, security hardened
3. **Data Encryption at Rest (X4)** — [Encrypted] attribute, EF ValueConverter, DataProtection

## Lesson 1: Agent Type Drift on Shared Interfaces

### Problem
Two agents independently produced incompatible type shapes for `WidgetConfig`. The `widget-registry.ts` interface used `row/col/width/height` (grid-based positioning) while `page.tsx` used `order/size` (simpler list-based). TypeScript caught this at build time: `Property 'order' does not exist on type 'WidgetConfig'`.

### Root Cause
When multiple agents build producer and consumer sides of a shared interface, they make different design choices without coordinating exact field names. The backend DTO shape was grid-based but the frontend consumer assumed a simpler model.

### Solution
The `npx next build` TypeScript check caught the mismatch. Both sides were aligned to the grid-based `row/col/width/height` format matching the backend DTO shape.

### Pattern
When backend creates DTOs, frontend agent must receive the **exact TypeScript interface shape** via team message. Frontend should import or reference the agreed shape, not reinvent it. Always verify type compatibility with `npx next build` before marking frontend tasks complete.

### Prevention
- Backend architect messages frontend with exact DTO fields before frontend work starts
- Frontend creates types matching backend DTOs, never inventing parallel shapes
- `npx next build` is a mandatory gate before any task is marked complete

## Lesson 2: Static Registration Pattern for Cross-Cutting Concerns

### Problem
Adding `IFieldEncryptionService` to the `PitbullDbContext` constructor would break 2,000+ unit tests that instantiate the DbContext.

### Solution
Used a static `RegisterEncryptionService()` method following the existing `RegisterModuleAssembly()` pattern:

```csharp
// In PitbullDbContext
private static IFieldEncryptionService? _encryptionService;
public static void RegisterEncryptionService(IFieldEncryptionService service)
    => _encryptionService = service;

// In Program.cs (after app build)
PitbullDbContext.RegisterEncryptionService(
    app.Services.GetRequiredService<IFieldEncryptionService>());
```

### Pattern
When adding cross-cutting services that need access from within EF ValueConverters or OnModelCreating, use static registration instead of constructor injection. This preserves backward compatibility with existing test fixtures and avoids cascading constructor changes.

### When to Use
- Service touches DbContext but modifying the constructor would break many tests
- Service is needed in OnModelCreating or ValueConverter (where DI isn't available)
- Existing pattern: `RegisterModuleAssembly()` already uses this approach

## Lesson 3: Security Hardening for Public/Anonymous Endpoints

### Problem
`VendorPortalController` has `[AllowAnonymous]` endpoints. Initial implementation exposed internal data:
- Full tokens in list endpoint
- Distinct error codes (`INVALID_TOKEN`, `TOKEN_REVOKED`, `TOKEN_EXPIRED`) enabling token state enumeration
- Internal fields (`ReviewedByUserId`, `DocumentPath`) in portal DTOs

### Solution
Three-layer defense:
1. **Masked tokens:** `VendorPortalTokenSummaryDto` shows `***...last4` in list; full token only returned once at generation
2. **Generic errors:** Public endpoints return `"Invalid or expired link"` with specific reason logged server-side only
3. **Dedicated DTOs:** `VendorPortalLienWaiverDto` omits internal fields for portal responses

### Pattern
Any `[AllowAnonymous]` endpoint requires:
- Dedicated response DTO exposing only what the anonymous user needs
- Never reuse internal DTOs for public endpoints
- Generic error messages to client; specific reasons in server logs
- Rate limiting by IP (not user, since unauthenticated)

## Lesson 4: Single Migration for Multi-Agent Entity Creation

### Problem
Multiple agents creating entities simultaneously can produce multiple migrations with snapshot corruption (documented in prior compound lesson). Each migration captures the full model delta, leading to duplicate AddColumn calls.

### Solution
Coordinated entity creation with strict task dependencies:
1. All entity definitions completed first (Tasks 1, 3, 5 — parallel)
2. Single migration generated after ALL entities finalized (Task 6 — blocked by 1, 3, 5)
3. Migration verified: `grep "CreateTable"` and diff against previous migration

### Pattern
In multi-agent sprints:
1. Create all new entities/configurations before running `dotnet ef migrations add`
2. Use task dependencies (`addBlockedBy`) to enforce sequential migration generation
3. Always diff new migration against recent migrations for duplicate operations
4. Run `dotnet build` after migration to verify compilation

## Lesson 5: Build Gate as Final Defense

### Problem
Agents may complete tasks without verifying cross-agent integration. Type mismatches, missing imports, and interface drift are only caught by the full build.

### Solution
Made build verification a mandatory final sprint task:
- `dotnet build src/Pitbull.Api/Pitbull.Api.csproj` — 0 warnings
- `dotnet test tests/Pitbull.Tests.Unit/` — all pass
- `npx next build` — TypeScript compilation succeeds

### Pattern
Every sprint ends with a build verification task that is blocked by ALL other tasks. This catches integration issues between agents that individual tasks miss.

## Files Affected

### New Files
- `src/Modules/Pitbull.Core/Domain/DashboardPreference.cs`
- `src/Modules/Pitbull.Core/Domain/VendorPortalToken.cs`
- `src/Modules/Pitbull.Core/Domain/EncryptedAttribute.cs`
- `src/Modules/Pitbull.Core/Services/FieldEncryptionService.cs`
- `src/Modules/Pitbull.Core/Data/EncryptedStringConverter.cs`
- `src/Modules/Pitbull.Billing/Services/VendorPortalService.cs`
- `src/Pitbull.Api/Controllers/VendorPortalController.cs`
- `src/Pitbull.Web/pitbull-web/src/components/dashboard/widgets/` (11 components)
- `src/Pitbull.Web/pitbull-web/src/app/portal/[token]/` (4 pages)
- `tests/Pitbull.Tests.Unit/Services/DashboardPreferencesServiceTests.cs`
- `tests/Pitbull.Tests.Unit/Services/VendorPortalServiceTests.cs`
- `tests/Pitbull.Tests.Unit/Security/FieldEncryptionServiceTests.cs`

### Modified Files
- `src/Modules/Pitbull.Core/Data/PitbullDbContext.cs` (DbSets, encryption auto-discovery)
- `src/Modules/Pitbull.Core/Domain/Vendor.cs` (encrypted bank fields)
- `src/Modules/Pitbull.TimeTracking/Domain/EmployeeTaxCompliance.cs` (encrypted SsnLastFour)
- `src/Pitbull.Api/Services/DashboardPreferencesService.cs` (in-memory to DB)
- `src/Pitbull.Api/Controllers/DashboardPreferencesController.cs` (extended)
- `src/Pitbull.Api/Program.cs` (service registrations, rate limit policy)

## Cross-References
- `docs/solutions/2026-02-compound-lessons.md` — Migration duplication, service constructor breakage, DataProtection persistence
- `CLAUDE.md` — Settled decisions (string enums, UTC dates, DataProtection), module boundaries
