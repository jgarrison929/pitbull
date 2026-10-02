# Login / explore as role

## User POV

I open the Pitbull web UI, enter as one known demo role, and confirm that the session lands in a usable, role-appropriate starting point. I do not assume that a role can see another role's data.

Known demo credentials from the interview:

- Password: `PitbullDemo2026!`
- Known emails: `ceo@demo.local`, `pm@demo.local`
- Additional demo roles/emails must be discovered from `GET /api/auth/demo-roles` or existing `e2e\` coverage (live keys include `ceo`, `cfo`, `pm`, `estimator`, `superintendent`, `contractadmin`, `payroll`); do not guess unpublished emails.

## Sub-features

- Demo-enabled role login through `POST /api/auth/demo-role-login`.
- Opening the Pitbull web UI at `http://localhost:3000`.
- Exploring the first authenticated surface and confirming visible role context.
- Returning to the feature index without changing unrelated data.

## How to get to it

1. From `C:\pitbull-private`, ensure the environment has been checked with `doctor.ps1`.
2. If a later run explicitly authorizes startup, use the known commands: `docker compose up -d`; `dotnet run --project src/Pitbull.Api`; then from `src/Pitbull.Web/pitbull-web`, `npm run dev`.
3. Confirm API health at unauthenticated `http://localhost:5081/health/live` and the web at `http://localhost:3000`.
4. Only when Demo is enabled, use the existing login flow or `POST /api/auth/demo-role-login` with a known demo email and `PitbullDemo2026!`.

## Driving with control helpers / Playwright

- First inspect the existing tests and helpers in `C:\pitbull-private\e2e\`.
- Prefer the repository's `scripts\run-role-e2e.ps1` and its documented role flow over a new ad-hoc runner.
- Use accessible labels, roles, and existing helpers. Do not guess selectors or add arbitrary sleeps.
- Capture the post-login landing state under `.cursor\skills\verify-pitbull\evidence\`.

## Gotchas

- Demo login is conditional: do not attempt it when Demo is disabled.
- A successful HTTP/API response is not proof that the browser session is usable; verify the user-visible page.
- Do not reuse or corrupt another person's browser session. If session ownership or Docker/Postgres isolation is unclear, stop and report `BLOCKED`.
- Cleanup must stop only this run's identified processes/containers; never kill by bare process name. Keep evidence.
