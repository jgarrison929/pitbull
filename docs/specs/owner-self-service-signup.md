# Spec: Owner Self-Service Signup (v2.0.1)

## Problem

New owners cannot discover or complete account creation: the login page only promotes the demo path, and post-registration tenant provisioning fails under PostgreSQL RLS because `app.current_tenant` is unset in the provisioning scope.

## User journey

1. Visit `/login` → click **Create an account** → `/signup`
2. Complete 3-step wizard (account, company, optional invites)
3. `POST /api/auth/register` creates tenant, default company, Admin role, `UserCompanyAccess`, JWT
4. Redirect to `/settings/company/setup` as authenticated owner
5. Sign out → sign in again at `/login` with same credentials

## Config matrix

| Environment | Demo.Enabled | DisableRegistration | Register allowed |
|-------------|--------------|---------------------|------------------|
| Production (`appsettings.json`) | false | false | Yes |
| Development | true | false | Yes |
| Public demo (prod + demo on) | true | true | No (404) |

Registration is blocked only when **both** `Demo.Enabled` and `DisableRegistration` are true.

## API touchpoints

- `POST /api/auth/register` — creates tenant/company/user; provisions defaults post-commit
- `POST /api/auth/login` — re-authenticates owner
- `GET /api/users/me` — profile with Admin role and company access
- `GET /api/admin/users` — requires `Admin.Users` policy (wildcard for Admin role)

## Implementation

1. `middleware.ts` — redirect `/signup` → `/demo` only when `NEXT_PUBLIC_DISABLE_REGISTRATION=true`
2. `TenantProvisioningService.ProvisionTenantAsync` — RLS-scoped transaction; participates in registration transaction
3. `RoleSeeder.EnsureRolesForTenantAsync` — lookup uses `{tenantId}:{roleName}` identity name
4. `AuthController.Register` — provisioning before commit; registration fails if provisioning fails
5. `login/page.tsx` — primary CTA link to `/signup`; keep demo as secondary
6. `appsettings.json` — `DisableRegistration: false` when demo disabled (clarity)
7. `OwnerSignupIntegrationTests` + `owner-signup.spec.ts` Playwright flow

## Test plan

- Integration: `OwnerSignupIntegrationTests` — register, wizard-equivalent payload, role count, login round-trip
- Playwright: `owner-signup.spec.ts` — full wizard submit, `POST /api/auth/register`, cookie `pitbull_token`, `/admin/users` without login redirect
- Vitest: `auth.test.ts` — `buildAuthCookie` omits `Secure` on `http://localhost`
- Regression: existing `AuthFlowTests` unchanged

## PR

Branch: `feat/owner-self-service-signup` → `main`