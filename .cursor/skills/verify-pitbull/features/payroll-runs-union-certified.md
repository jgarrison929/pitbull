# Payroll runs / union rates / certified payroll

## User POV

I enter as a payroll processor, generate a payroll run from a locked pay period with approved time, approve and export it, confirm union package rates when affiliations exist, produce certified payroll (WH-347) for a certified project, post the run to GL once (second post is idempotent), and see net pay labeled as a proxy when no tax vendor/table is configured. I do not invent FICA rates.

## Sub-features

- Payroll run lifecycle: `POST /api/payroll/runs/generate` -> `POST /api/payroll/runs/{id}/approve` -> `POST /api/payroll/runs/{id}/export`
- Union rate catalog: `GET /api/payroll/agreements`, `GET /api/payroll/packages`, `GET /api/payroll/classifications` (and create when not demo-read-only)
- Employee union affiliation: `POST /api/employee-onboarding/{employeeId}/union-affiliations` (drives `RateSource=UnionPackage` on generate)
- Prevailing wage check: `POST /api/payroll/runs/{id}/validate-prevailing-wage`
- Certified payroll: `GET /api/payroll/certified` (list), `POST /api/payroll/certified/generate`, `GET /api/payroll/certified/{id}` (report by id; unknown id -> `NOT_FOUND`), `GET /api/payroll/certified/{payrollRunId}/wh347-pdf`
- GL post idempotency: `POST /api/payroll/runs/{id}/post` (second call returns `alreadyPosted: true` with the same journal entry)
- Net proxy labeling: generated run includes `netIsProxy: true` when `taxTableVersionId` is null / tax vendor unconfigured

## How to get to it

1. From `C:\pitbull-private`, run `.cursor\skills\verify-pitbull\doctor.ps1` (Docker, Postgres `:5432`, API `:5081`, web `:3000`).
2. Prefer payroll processor identity:
   - `GET /api/auth/demo-roles` lists key `payroll` -> email `mgr-payroll@demo.local` (live-verified 2026-09-28).
   - Prefer `POST /api/auth/demo-role-login` with `{ "role": "payroll" }`. Rapid repeats can return `429 RATE_LIMITED`; wait and retry, or use password login.
   - Password login also works: `mgr-payroll@demo.local` / `PitbullDemo2026!` via `POST /api/auth/login`.
   - `payroll@demo.local` is not a seeded login (401).
   - **Gotcha:** demo principals are blocked from payroll writes (`DEMO_READ_ONLY`; generate returns 403 on `/api/payroll/*` mutations). Read proofs work; write proofs need a non-demo user in the same tenant with Payroll RBAC (or a non-`@demo.local` verify account).
3. Confirm an eligible pay period: `GET /api/pay-periods` - period must be **Locked** or **Closed** (not Open), with approved time entries and no existing payroll run. Lock with `POST /api/pay-periods/{id}/lock` when needed.
4. Optional union path before generate:
   - Ensure classification exists (`GET /api/payroll/classifications`).
   - Create agreement `POST /api/payroll/agreements`, package `POST /api/payroll/packages` (needs ST pay component via `GET/POST /api/payroll/components`).
   - Attach affiliation `POST /api/employee-onboarding/{employeeId}/union-affiliations` with `unionAgreementId`, `workClassificationId`, `scaleCode`.
5. Generate -> approve -> export with the routes above. Capture JSON under `evidence\`.
6. For certified: project must have `CertifiedPayroll=true`. Then `POST /api/payroll/certified/generate` with `payrollRunId`, `projectId`, `weekEnding`; download WH-347 via `GET /api/payroll/certified/{payrollRunId}/wh347-pdf`.
7. Post to GL: `POST /api/payroll/runs/{id}/post` twice; expect first `alreadyPosted:false`, second `alreadyPosted:true` and same `journalEntryId`.

## Driving with control helpers / Playwright

- Inspect `e2e\` personas (`payrollManager` -> `mgr-payroll@demo.local`) and any payroll specs before inventing UI selectors.
- API-first is the reliable smoke path for this feature; UI nav labels include Payroll Reviews (`/payroll/reviews`) and Pay Periods (`/admin/pay-periods`) but write flows may be demo-gated in the browser too.
- Prefer stable API evidence files over brittle UI clicks for generate/approve/export/post.

## Gotchas

- **Demo-role rate limit:** burst `demo-role-login` calls can return `429 RATE_LIMITED`; space attempts or fall back to password login for `mgr-payroll@demo.local`.
- **Live API vs this checkout:** local API may expose union catalog (`/api/payroll/agreements|packages|classifications|components`) and a `payroll` demo persona even when this git tip's `AuthController` / controller set lags. Prefer live `doctor` + endpoint probes over assuming the tree matches the running binary.
- **Demo read-only:** `DemoRestrictionMiddleware` blocks non-GET on `/api/payroll` for `is_demo_user` / `*@demo.local`. Read proofs work; mutations need a non-demo principal.
- **Schema drift on this branch (local verify):** missing `payroll_runs.GlJournalEntryId` migration and missing `pay_slips` / `pay_slip_lines` tables caused generate/list failures until local DDL matched the EF model. Prefer a real EF migration before treating env as green.
- **Pay period gate:** Open periods refuse generate (`PAY_PERIOD_NOT_LOCKED`). Duplicate run per period also fails.
- **UnionPackage:** affiliation must use `/api/employee-onboarding/...` (not `/api/employees/...`). Without a matching wage package + ST component, union rows fail resolve instead of falling back.
- **Certified:** `PROJECT_NOT_CERTIFIED` if the project flag is off. WH-347 PDF can still return for a run even when certified generate was blocked earlier.
- **Export vs exports:** run export is `POST /api/payroll/runs/{id}/export` (Allowed from Approved). `POST /api/payroll/exports/generate` expects Approved and will fail after the run is already Exported/Posted.
- **OT / CA:** company `ReportOvertimeRules` may be `Federal` rather than `California`. OT hours can still appear; do not claim CA OT seed unless settings prove California.
- **Net proxy:** when tax vendor/tables are unconfigured, `netIsProxy` stays true and net tracks gross - do not invent FICA.
- Cleanup must not stop Docker/API/web this run did not start. Keep evidence under `.cursor\skills\verify-pitbull\evidence\`.
