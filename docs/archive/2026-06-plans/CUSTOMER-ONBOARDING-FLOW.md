# Customer Onboarding Flow — Design Spec

**Author:** Codex (for Pitbull team)  
**Date:** 2026-02-17  
**Status:** Proposed (implementation-ready)  
**Primary Surfaces:** API (`src/Pitbull.Api`), Web (`src/Pitbull.Web/pitbull-web`), Core domain settings (`src/Modules/Pitbull.Core`)

---

## 1. Objective

Design an end-to-end onboarding flow that converts a first-time signup into a configured, multi-user tenant with:
- verified identity (email verification)
- provisioned tenant/company context
- completed company setup wizard
- invited team members with role assignment
- guided first-use experience (tour, sample data, checklist)

This spec extends existing patterns in:
- `src/Pitbull.Api/Controllers/AuthController.cs`
- `src/Pitbull.Api/Infrastructure/RoleSeeder.cs` (incl. PR #154 role behavior)
- `src/Pitbull.Api/Controllers/ModuleSettingsController.cs`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/settings/company/setup/page.tsx` (PR #153)

---

## 2. Current-State Baseline

## Existing behavior

- Registration currently auto-creates tenant when `TenantId` is not provided (`AuthController.Register`).
- Default company access is created for the registering user.
- Role assignment uses `RoleSeeder` (first user Admin, later users Viewer from PR #154 behavior).
- Module settings exist and are retrievable in aggregate (`ModuleSettingsController.GetAll`).
- Company setup wizard exists in dashboard settings (`/settings/company/setup`).

## Gap

- No email verification gate before account activation.
- No dedicated customer onboarding route funnel (`/signup`, `/verify-email`, `/setup`, `/invite/[token]`).
- No invite token model or invite acceptance endpoint.
- No persisted onboarding progress/checklist/tour state.
- Setup wizard exists but is not integrated as a first-login blocking flow.

---

## 3. Target User Journey

1. User visits `/signup`, creates account.
2. System creates tenant (if first signup) and sends verification email.
3. User opens `/verify-email?token=...` and verifies email.
4. User signs in; if setup incomplete, redirected to `/setup`.
5. User completes setup wizard (company profile + module/settings baseline).
6. User invites team members via setup step.
7. Invited user opens `/invite/[token]`, sets password, joins tenant with assigned role.
8. First authenticated dashboard session starts welcome tour + checklist + optional sample data.

---

## 4. Functional Scope

## 4.1 Registration + Email Verification

### Requirements

- Registration remains public and rate-limited (reuse AuthController conventions).
- Email must be verified before full app access.
- Resend verification endpoint with throttling.
- Verification token must be single-use, expiring, and auditable.

### Proposed behavior

- `POST /api/auth/register`:
  - create user + tenant/company/access as today
  - set `EmailConfirmed = false`
  - return `201` with `requiresEmailVerification = true`
  - send verification email with signed token link to `/verify-email`
- `POST /api/auth/verify-email` validates token and confirms user email.
- `POST /api/auth/resend-verification` reissues token with anti-spam limit.
- Login allowed, but API access to onboarding/dashboard routes returns `403 EMAIL_NOT_VERIFIED` until confirmed (except verify/resend/profile-lite endpoints).

---

## 4.2 Tenant Provisioning (Auto-create on First Signup)

### Requirements

- Preserve existing auto-create behavior in `AuthController.Register`.
- Ensure idempotent tenant bootstrap actions.
- Ensure first user receives Admin role per existing `RoleSeeder` pattern.

### Proposed behavior

- Continue creating `Tenant` when no `TenantId` supplied.
- Continue creating default `Company` and `UserCompanyAccess`.
- Continue role seeding through `RoleSeeder.EnsureRolesForTenantAsync` and assignment.
- Add `OnboardingState` record on first signup to track setup completion/version.

---

## 4.3 Company Setup Wizard (Extend PR #153)

### Requirements

- Reuse existing setup wizard concepts and module settings endpoints.
- Convert setup to first-login flow (`/setup`) with persisted progress.
- Keep `/settings/company/setup` for post-onboarding edits.

### Proposed enhancements

- Extract wizard UI logic into reusable component used by:
  - `/setup` (guided required flow)
  - `/settings/company/setup` (editable admin settings flow)
- Add server-side onboarding state APIs:
  - `GET /api/onboarding/state`
  - `PUT /api/onboarding/state`
  - `POST /api/onboarding/complete`
- Persist:
  - current step
  - skipped sections
  - completed timestamp
  - selected contractor type/profile
- `POST /api/onboarding/complete` marks setup complete and enables welcome checklist start.

---

## 4.4 Team Invitation System

### Requirements

- Admin can invite users by email during setup or later.
- Role assignment at invite-time (`Viewer`, `Manager`, `Supervisor`, `Admin` per tenant policy).
- Invite token flow uses secure expiration and one-time acceptance.

### Proposed behavior

- `POST /api/invitations` (Admin):
  - create invite with role + optional company access defaults
  - send email link to `/invite/[token]`
- `GET /api/invitations` list pending/accepted/expired invites.
- `POST /api/invitations/{id}/revoke` soft-revoke pending invite.
- `POST /api/invitations/accept`:
  - validates token
  - creates user if not existing OR links existing email in tenant-safe way
  - sets password (if new account)
  - confirms email implicitly for invite acceptance or requires verify step based on setting
  - assigns invited role using `RoleSeeder.AssignRoleToUserAsync`

---

## 4.5 Welcome Experience

### Components

1. **Guided tour**
- Lightweight progressive tooltips for dashboard nav + core actions.
- Shown once per user; restartable in help menu.

2. **Sample data**
- Optional one-click seed (project, bid, subcontract, RFI, time entry) under tenant/company.
- Idempotent and tagged as sample.

3. **Quick-start checklist**
- Example items:
  - verify email
  - complete setup wizard
  - invite first teammate
  - create first project
  - create first bid or time entry
- Progress persisted per user and summarized on dashboard.

---

## 4.6 Frontend Routes (Required)

## New/updated routes

- `/signup`
  - public registration form
  - submit to `POST /api/auth/register`
  - success state with resend verification action

- `/verify-email`
  - public token verification page
  - reads token from query string
  - calls `POST /api/auth/verify-email`

- `/setup`
  - authenticated, email-verified route
  - hosts extended setup wizard (from PR #153 component)
  - blocks access to main dashboard until `onboarding.complete=true` (except allowed routes)

- `/invite/[token]`
  - public accept-invite flow
  - shows invite metadata (tenant, inviter, role)
  - sets password/profile, accepts invite via `POST /api/invitations/accept`

---

## 5. Domain and Data Model

## New entities

All entities inherit `BaseEntity`; company-scoped entities implement `ICompanyScoped` where applicable.

1. `TenantOnboardingState` (tenant-scoped)
- `TenantId`
- `Status` (`NotStarted|InProgress|Completed`)
- `CurrentStep`
- `CompletedAt`
- `WizardVersion`
- `Data` (jsonb for flexible wizard metadata)

2. `UserOnboardingProgress` (user-scoped)
- `UserId`
- `TourCompletedAt`
- `ChecklistJson` (jsonb)
- `SampleDataCreatedAt`

3. `UserEmailVerificationToken`
- `UserId`
- `TokenHash`
- `ExpiresAt`
- `ConsumedAt`
- `Purpose` (`VerifyEmail`)

4. `TeamInvitation`
- `TenantId`
- `CompanyId` (optional default target)
- `Email`
- `RoleName` (logical role, e.g. Viewer)
- `TokenHash`
- `Status` (`Pending|Accepted|Revoked|Expired`)
- `ExpiresAt`
- `AcceptedAt`
- `InvitedByUserId`

## Configuration entity

5. `CustomerOnboardingSettings` (tenant/company configurable)
- `RequireEmailVerification` (default true)
- `InviteExpiryHours` (default 72)
- `AllowSampleData` (default true)
- `AutoConfirmInvitedUsers` (default false)
- `RequireSetupBeforeDashboard` (default true)

---

## 6. API Design

## Auth/verification

- `POST /api/auth/register`
  - extend response: `{ token?, userId, requiresEmailVerification, setupRequired }`
- `POST /api/auth/verify-email`
  - request: `{ token }`
- `POST /api/auth/resend-verification`
  - request: `{ email }`

## Onboarding state

- `GET /api/onboarding/state`
- `PUT /api/onboarding/state`
- `POST /api/onboarding/complete`
- `POST /api/onboarding/sample-data`

## Invitations

- `POST /api/invitations`
- `GET /api/invitations`
- `POST /api/invitations/{id}/revoke`
- `GET /api/invitations/by-token/{token}` (limited metadata)
- `POST /api/invitations/accept`

## Checklist/tour

- `GET /api/onboarding/welcome`
- `PUT /api/onboarding/welcome/checklist`
- `POST /api/onboarding/welcome/tour-complete`

### API conventions

- Controllers follow direct service injection pattern (no MediatR in controllers).
- Protected endpoints use `[Authorize]`.
- Anonymous endpoints (`verify-email`, `accept-invite`) must be rate-limited.
- All queries must include `!IsDeleted` where applicable.

---

## 7. Backend Implementation Approach

## Services

Add service interfaces/implementations:
- `IEmailVerificationService`
- `IInvitationService`
- `ITenantOnboardingService`
- `IWelcomeExperienceService`

## Controller additions

- Extend `AuthController` for verify/resend behavior.
- Add `OnboardingController`.
- Add `InvitationsController`.

## Email delivery

- Reuse existing email infrastructure (`Pitbull.Email`).
- Templates:
  - Verify email
  - Team invitation
  - Invite accepted notification

## Security

- Store token hashes, never plaintext tokens.
- Signed one-time tokens with expiry checks.
- Validate tenant boundaries on invite acceptance.
- Audit log entries for invite creation/revoke/accept and email verify.

---

## 8. Frontend Implementation Approach

## Pages

- `src/Pitbull.Web/pitbull-web/src/app/(auth)/signup/page.tsx`
- `src/Pitbull.Web/pitbull-web/src/app/(auth)/verify-email/page.tsx`
- `src/Pitbull.Web/pitbull-web/src/app/(dashboard)/setup/page.tsx`
- `src/Pitbull.Web/pitbull-web/src/app/(auth)/invite/[token]/page.tsx`

## Components

- `components/onboarding/setup-wizard.tsx` (extract/extend existing company wizard)
- `components/onboarding/invite-form.tsx`
- `components/onboarding/welcome-checklist.tsx`
- `components/onboarding/product-tour.tsx`

## Routing guards

- Middleware/app-shell check:
  - if authenticated and not email verified => redirect `/verify-email`
  - if setup required and incomplete => redirect `/setup`

## API client types

- Extend `src/lib/types.ts` with:
  - `OnboardingStateDto`
  - `InvitationDto`
  - `VerifyEmailRequest/Response`
  - `WelcomeChecklistDto`

---

## 9. RBAC and Role Rules

- Invitation role assignment must map to `RoleSeeder` logical names.
- Default role for newly invited users should remain `Viewer` unless invite specifies otherwise.
- Only Admin can invite/revoke by default.
- Future option: `Manager` can invite `Viewer` only (settings toggle).

---

## 10. Data Migration and Rollout

## Migrations

1. Add entities/tables for onboarding state, email verification tokens, invitations, welcome progress.
2. Add optional onboarding settings on company/tenant settings container.
3. Backfill existing users:
- `EmailConfirmed = true` for pre-existing production users (one-time script/migration strategy, environment-gated).
- `TenantOnboardingState = Completed` for existing active tenants.

## Rollout phases

- Phase 1: backend entities + endpoints, no forced redirects.
- Phase 2: frontend `/signup`, `/verify-email`, `/invite/[token]`.
- Phase 3: `/setup` gating + welcome checklist/tour.
- Phase 4: sample data seeding + analytics instrumentation.

---

## 11. Observability and Analytics

Track funnel metrics:
- signup started/completed
- email verification sent/completed
- setup started/completed
- first invite sent/accepted
- checklist completion rate
- time-to-first-project

Add structured logs with tenant/user identifiers and correlation IDs.

---

## 12. Testing Strategy

## Unit tests

- token generation/validation/expiry/one-time-use
- invite lifecycle (create/revoke/accept)
- onboarding state transitions
- redirect gating rules

## Integration tests

- full flow: signup -> verify -> setup complete -> invite -> accept
- tenant isolation and role assignment checks
- soft-delete behaviors on invitation records

## Frontend tests

- route guards (`/verify-email`, `/setup` redirects)
- wizard persistence and resume
- invite acceptance UX and error states

---

## 13. Open Questions

1. Should invited users require separate email verification after accepting invite?
2. Should setup completion be tenant-wide (first admin only) or required per company in multi-company tenants?
3. Should sample data be reversible (single purge action) and who can trigger it?
4. Do we allow SSO tenants to bypass email verification while still using invite tokens?

---

## 14. Deliverables Checklist

- [ ] New API endpoints implemented and documented in Swagger
- [ ] New entities/migrations for verification, invitations, onboarding state
- [ ] `/signup`, `/verify-email`, `/setup`, `/invite/[token]` pages implemented
- [ ] Setup wizard extracted and reused from PR #153 implementation
- [ ] Welcome checklist + tour + sample data flow implemented
- [ ] Tests (unit + integration + frontend) green
