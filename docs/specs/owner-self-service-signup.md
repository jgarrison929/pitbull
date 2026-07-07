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

1. `TenantProvisioningService.ProvisionTenantAsync` — set `app.current_tenant` before queries (RLS)
2. `login/page.tsx` — primary CTA link to `/signup`; keep demo as secondary
3. `appsettings.json` — `DisableRegistration: false` when demo disabled (clarity)
4. `OwnerSignupIntegrationTests` — register → Admin JWT → me → login → admin users

## Test plan

- Integration: `OwnerSignupIntegrationTests` (2 runs captured to scratch)
- Regression: existing `AuthFlowTests` unchanged
- Frontend: static assert `/signup` link on login page; `npm run build`

## PR

Branch: `feat/owner-self-service-signup` → `main`