# Payroll runs / union rates / certified payroll

## User POV

I enter as a payroll processor, open Payroll Runs, inspect a run generated from a locked pay period, see its employee lines and gross/net, open Certified Payroll (WH-347) for a run, and confirm demo identities cannot mutate payroll. When the PR #583 payroll build is running I can also check union package rates, prevailing-wage validation, GL post idempotency, and the net-is-proxy label. I do not invent FICA rates.

## What exists where (source-verified 2026-10-07)

On `origin/main` (3.8.2, `88a686d3`):

- Runs: `GET/POST /api/payroll/runs`, `GET/PUT/DELETE /api/payroll/runs/{id}`, `POST /api/payroll/runs/generate`, `POST /api/payroll/runs/{id}/approve`, `POST /api/payroll/runs/{id}/export` (`src/Pitbull.Api/Controllers/PayrollRunsController.cs`).
- Certified: `GET /api/payroll/certified` (list), `POST /api/payroll/certified/generate`, `GET /api/payroll/certified/{payrollRunId}/wh347-pdf` (`CertifiedPayrollController.cs`). There is **no** `GET /api/payroll/certified/{id}` on main.
- Pay periods: `GET /api/pay-periods`, `GET /api/pay-periods/current`, `POST /api/pay-periods/{id}/lock|unlock|close`, `GET /api/pay-periods/{id}/summary` (`PayPeriodsController.cs`).
- Reviews: `/api/payroll/reviews` (`PayrollReviewsController.cs`, `[Authorize(Roles = "Admin,ProjectManager")]`).
- Exports: `GET /api/payroll/exports`, `POST /api/payroll/exports/generate`, `GET /api/payroll/exports/{id}/download`.
- Wage determinations: `/api/payroll/wage-determinations` (+ `lookup-rate`).
- Union affiliation: `GET/POST/DELETE /api/employee-onboarding/{employeeId}/union-affiliations` (`EmployeeOnboardingController.cs`).
- Run status enum: Draft=1 ... Exported=6 (`src/Modules/Pitbull.Core/Domain/PayrollCompliance.cs`). No `netIsProxy` field.
- Web: `/payroll/runs`, `/payroll/runs/{id}`, `/payroll/certified`, `/payroll/reviews`, `/payroll/exports`, `/payroll/wage-determinations`, `/admin/pay-periods`.

Only on unmerged PR #583 (`feat/payroll-p0-p3`, head `9703e158`), absent from main:

- Union catalog: `/api/payroll/agreements`, `/api/payroll/packages`, `/api/payroll/classifications`, `/api/payroll/components` (+ web `/payroll/agreements|packages|classifications`).
- `POST /api/payroll/runs/{id}/validate-prevailing-wage`, `POST /api/payroll/runs/{id}/post` (GL post, `alreadyPosted`), run status `Posted = 7`, `netIsProxy` on run DTOs.
- `GET /api/payroll/certified/{id}`, `PUT /api/payroll/certified/{id}/statement`, `POST /api/payroll/certified/{id}/submit`.
- Demo role keys `payroll` / `payrollspecialist` -> `mgr-payroll@demo.local`.

Treat the #583-only items as `verified-unreachable` (prerequisite: an API built from PR #583 or from main after #583 merges) unless `GET /api/version` shows that build. A 404 on those GETs against a main-based build is expected, not a product bug.

## How to get to it

1. From `C:\pitbull-private`, run `.cursor\skills\verify-pitbull\doctor.ps1`, then read `GET /api/version` to learn which commit the running API was built from.
2. Payroll identity: password login `POST /api/auth/login` with `mgr-payroll@demo.local` / `PitbullDemo2026!` (role `Manager`). On main, `POST /api/auth/demo-role-login {"role":"payroll"}` returns `400 Unknown demo role`. `payroll@demo.local` is not seeded (401).
3. Read path (works for the demo identity): `GET /api/pay-periods` (look for Locked/Closed), `GET /api/payroll/runs`, `GET /api/payroll/runs/{id}`, `GET /api/payroll/certified`, `GET /api/payroll/certified/{runId}/wh347-pdf` (application/pdf), `GET /api/payroll/exports`, `GET /api/payroll/wage-determinations`.
4. UI: sign in through the `/login` email form, open `/payroll/runs`, follow a run's View link to `/payroll/runs/{id}`, then `/payroll/certified`.
5. Write path (generate -> approve -> export, certified generate, union affiliation) needs a non-demo principal with payroll rights in the same tenant. A period must be Locked/Closed (`PAY_PERIOD_NOT_LOCKED` otherwise) with approved time and no existing run. Certified generate needs a project with `CertifiedPayroll=true` (`PROJECT_NOT_CERTIFIED` otherwise).

## Driving with control helpers / Playwright

- e2e persona `payrollManager` -> `mgr-payroll@demo.local` (`e2e/fixtures/roles.ts`). `e2e/tests/role-workflows.spec.ts` L3b payroll tests lock periods and generate/approve/export runs, so they mutate shared data.
- API-first is the reliable read smoke. The UI pages render the same runs and certified reports.
- Use `drive-one.ps1` (read-only mode) for the API smoke. It records every status code.

## Gotchas

- **Demo read-only fires before routing:** `DemoRestrictionMiddleware` (`src/Pitbull.Api/Middleware/DemoRestrictionMiddleware.cs`) returns `403 DEMO_READ_ONLY` for every non-GET under `/api/payroll` for demo principals, including POST routes that don't exist on the running build (for example `validate-prevailing-wage` and `/post` on main). So a 403 does not prove a route exists; check source or the GET shape.
- **Payroll Reviews:** `/api/payroll/reviews` requires the Identity role `Admin` or `ProjectManager`. No seeded demo persona has either role (mgr-payroll and CEO/CFO are `Manager`, PM is `Supervisor`), so `/payroll/reviews` shows "Failed to load pending payroll reviews" (403). Verified-unreachable with demo personas.
- **Pay Periods UI:** web middleware redirects non-Admin tokens away from `/admin/*` to `/`, so `/admin/pay-periods` is unreachable for demo personas. Use `GET /api/pay-periods`.
- **Shared DB from other branches:** the shared Postgres can hold rows written by a PR #583 build (for example a run with status `7` = Posted). A main-built API returns them as numeric `7`, and `/payroll/runs` shows `7`. That is environment contamination, not a main bug.
- **Demo-role rate limit:** `demo-role-login` uses the `demo-register` policy (10 per hour per client IP), so repeated role logins return `429 RATE_LIMITED`. Use password login for `mgr-payroll@demo.local`.
- **Export vs exports:** run export is `POST /api/payroll/runs/{id}/export` (from Approved). `POST /api/payroll/exports/generate` expects Approved and fails after Exported.
- **OT / CA:** company `ReportOvertimeRules` may be `Federal`. Do not claim California OT unless settings prove it.
- **Net:** with no tax tables configured, the live run detail on 2026-10-07 showed Net = Gross. Do not invent FICA. `netIsProxy` exists only on #583.
- Cleanup must not stop Docker/API/web this run did not start. Keep evidence under `.cursor\skills\verify-pitbull\evidence\`.