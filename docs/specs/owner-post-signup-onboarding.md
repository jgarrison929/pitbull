# Spec: Owner Post-Signup Onboarding Gate (v2.0.2)

**Status:** Shipped (historical) — **out of 2.12→3.0 ladder**

## Problem

After owner self-service signup, `GET /api/onboarding/status` treats setup as complete when the company name differs from `"{FirstName}'s Company"`. Owners who enter a company name in the signup wizard therefore bypass the 4-step company setup wizard and land on an empty dashboard. The setup wizard also never updates the onboarding checklist.

## User journey (target)

1. Complete `/signup` → redirect to `/settings/company/setup` (unchanged)
2. `GET /api/onboarding/status` returns `isSetupComplete: false` until wizard finishes
3. Dashboard (`/`) redirects back to setup while incomplete
4. Owner completes 4-step wizard → checklist marked → `isSetupComplete: true` → dashboard accessible

## API contract

### `GET /api/onboarding/status`

`isSetupComplete` is true only when the user's checklist has all four wizard steps:

| Checklist field | Wizard step |
|-----------------|-------------|
| `companyProfileCompleted` | Company Profile |
| `contractorTypeSelected` | Contractor Type |
| `modulesActivated` | Module Activation |
| `modulesConfigured` | Initial Settings |

Checklist is created on first status/checklist access for the registering user.

### `PUT /api/onboarding/checklist/{itemName}`

Company setup wizard calls this on **Complete Setup** for each wizard step.

## Touchpoints

- `src/Pitbull.Api/Services/OnboardingService.cs` — `isSetupComplete` from checklist, auto-create checklist
- `src/Pitbull.Api/Controllers/AuthController.cs` — seed checklist after register (optional; service handles lazy create)
- `src/Pitbull.Web/.../settings/company/setup/page.tsx` — mark checklist on save
- `tests/Pitbull.Tests.Integration/Api/OwnerSignupIntegrationTests.cs` — status incomplete after register, complete after checklist update

## Test plan

- Integration: register owner → `isSetupComplete == false`; mark 4 items → `true`
- Unit: `OnboardingServiceTests` for checklist-based completion
- Playwright: extend owner-signup or add onboarding redirect assertion (dashboard → setup when incomplete)

## PR

Branch: `fix/owner-post-signup-onboarding-gate` → `main`