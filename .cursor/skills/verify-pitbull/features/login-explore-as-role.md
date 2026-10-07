# Login / explore as role

## User POV

I open the Pitbull web UI, enter as one known demo role, and confirm the session lands on a usable, role-appropriate starting point. I do not assume one role can see another role's data.

Known demo credentials:

- Password: `PitbullDemo2026!`
- Demo role keys on `origin/main` (`DemoRolePersonas` in `src/Pitbull.Api/Controllers/AuthController.cs`): `ceo` -> `ceo@demo.local`, `cfo` -> `cfo@demo.local`, `pm` -> `pm@demo.local`, `estimator` -> `estimator@demo.local`, `superintendent` (alias `foreman`) -> `superintendent@demo.local`, `contractadmin` (alias `ca`) -> `contract-admin@demo.local`. `GET /api/auth/demo-roles` lists the 6 primary keys and hides the aliases.
- `payroll` / `payrollspecialist` keys exist only on unmerged PR #583. On main, use password login for `mgr-payroll@demo.local`.
- Other seeded logins (password login, not role keys) come from `src/Pitbull.Api/Demo/DemoBootstrapper.cs` and `e2e/fixtures/roles.ts` (for example `field-eng@`, `ar-clerk@`, `ap-clerk@`, `mgr-payroll@demo.local`). Do not guess others.

## Sub-features

- Role buttons on `/login`: CEO, CFO, Project Manager, Superintendent, Estimator, Contract Admin. They are loaded from `GET /api/auth/demo-roles` with a static fallback and call `POST /api/auth/demo-role-login` with body `{"role":"<key>"}`.
- Email/password form on the same page: an "or sign in with email" toggle, plus a submit button labeled "Sign In" (`POST /api/auth/login`).
- Session: the web stores the JWT in the `pitbull_token` cookie. `src/Pitbull.Web/pitbull-web/src/middleware.ts` redirects unauthenticated protected paths with `307` to `/login?redirect=...`. Public paths are `/login`, `/register`, `/signup`, `/invite`, `/forgot-password`, `/reset-password`, `/verify-email`, `/demo`, and `/portal`.
- Landing after login is `/` (dashboard briefing). `GET /api/auth/me` returns email and roles (live 2026-10-07: CEO -> `Manager`). The persona fallback Identity roles in `AuthController.cs` are `Manager` for ceo, cfo, and contractadmin, `Supervisor` for pm and superintendent, and `User` for estimator.

## How to get to it

1. Run `doctor.ps1` (Docker, `:5432`, API `:5081/health/live`, web `:3000`, and the informational `/api/version`).
2. API: `GET /api/auth/demo-roles` -> `POST /api/auth/demo-role-login {"role":"ceo"}` -> `GET /api/auth/me` with `Authorization: Bearer <token>`.
3. UI: open `http://localhost:3000/login` and click the `CEO` role button (`getByRole('button', { name: /^CEO\b/ })`). Expect the URL to leave `/login` and land on `/`.
4. Unauthenticated check: `GET /login` -> 200, and protected routes -> 307 to `/login`. A 307 only proves the middleware ran, not that a page exists at that path.

## Driving with control helpers / Playwright

- For email login use `getByRole('button', { name: /^sign in$/i })`. The looser `/sign in/i` also matches the "or sign in with email" toggle and fails Playwright strict mode. `e2e/fixtures/auth.setup.ts` (used only by the `demo-recording` project) still uses the loose selector, so it is a repo e2e issue outside this skill.
- Labels: `getByRole('textbox', { name: /email address/i })` and `getByRole('textbox', { name: /password/i })`.
- The page `h1` on every dashboard page is the "Pitbull" logo. Assert on `main` headings or text instead.
- `scripts\run-role-e2e.ps1` is not read-only (see SKILL.md). For a smoke, use `drive-one.ps1` read-only mode.

## Gotchas

- Demo login is conditional: `demo-role-login` returns 404 when `Demo:Enabled` is false and 400 for unknown keys (the message lists the supported keys).
- `demo-role-login` uses the `demo-register` rate-limit policy: a fixed window of **10 requests per hour per client IP** (`src/Pitbull.Api/Program.cs`), shared with `POST /api/auth/demo-register` and the `/login` role buttons. Unknown-key 400s also spend a permit. After about 10 role logins in an hour, the role button gets `429` and the page stays on `/login`. `live-api-smoke.ps1` spends one permit (CEO) and uses password login for everything else. `live-web-smoke.cjs` records a 429 and falls back to the email form. Password login (`login` policy) has a per-minute window.
- Demo principals are flagged `is_demo_user`, and financial/payroll mutations return `403 DEMO_READ_ONLY`.
- The web client sends `X-Company-Id` (active company, `src/Pitbull.Web/pitbull-web/src/lib/api.ts`). Header-less API calls can see a different company scope than the UI.
- Never reuse another person's browser session. Use a fresh Playwright context. Keep evidence, and stop only what this run started.