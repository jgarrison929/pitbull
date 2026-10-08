---
name: verify-pitbull
description: Verify the Pitbull web UI end to end from a user's perspective, including role login, workspace projects, time tracking, contracts/AIA billing, field daily reports, and payroll runs/union/certified. Use this skill when checking a local Pitbull web UI change or running a controlled role-based smoke test with evidence.
---

# Verify Pitbull

Use this skill to verify the **Pitbull web UI** as a user would: start only the local services you need, enter through a known demo role, exercise one feature at a time, and save screenshots or other evidence under `C:\pitbull-private\.cursor\skills\verify-pitbull\evidence\`.

## Non-negotiable safety and scope

- Repository: `C:\pitbull-private`.
- Don't run `docker compose down`, the full prove, or migrations against production. Only start services when the run calls for them, and record the PIDs this run started.
- Don't guess routes, selectors, role names, feature behavior, or script arguments. The feature playbooks cite the source files. Re-check them against `origin/main` when the code may have moved.
- Docker/Postgres is shared, and other branches' builds may have written rows to it (see the payroll gotchas). Don't double-drive the environment without separate ports or profiles. If ownership, ports, or session isolation are unclear, stop instead of risking the user's session.
- Never kill by bare process name. Cleanup may stop only processes or containers this skill started and can identify by PID.
- Keep evidence. Name it `<prefix>-<yyyyMMdd-HHmmss PT>-<feature>-*`.

## Known local topology

```text
cd C:\pitbull-private
docker compose up -d                    # pitbull-db (5432), pitbull-cache

dotnet run --project src/Pitbull.Api    # API: http://localhost:5081  (Development + Demo__Enabled)

cd src/Pitbull.Web/pitbull-web
npm run dev                             # Web: http://localhost:3000 (Next.js dev)
```

- Health: unauthenticated `http://localhost:5081/health/live` (also `/health` and `/health/ready`). The web's connection-status widget sends `HEAD /api/health` to the web origin, which 404s. That is noise, not a failure. Signed out, `/sw.js` and `/manifest.json` also get `307` to `/login` because the middleware matcher in `src/Pitbull.Web/pitbull-web/src/middleware.ts` only exempts `_next` assets, `favicon.ico`, and images. So every fresh context that opens `/login` logs the console error "The script resource is behind a redirect, which is disallowed." from `ServiceWorkerRegister`. That is noise too (with a token, `/sw.js` returns 200).
- Build identity: `GET http://localhost:5081/api/version` returns `version`, `buildDate`, and `commitHash`. A long-running API may be built from a different branch than the current checkout, so always record it. On main since #596, the release Docker image bakes in the commit and build date.
- Demo password `PitbullDemo2026!`. Role login is `POST /api/auth/demo-role-login {"role":"<key>"}`, which works only when Demo is enabled. Keys and emails are in [`features/login-explore-as-role.md`](features/login-explore-as-role.md).

## Drivers

| Driver | Mutates? | Use |
|---|---|---|
| `doctor.ps1` | no | Read-only checks: Docker, `:5432`, API health, web `:3000`, and the informational `/api/version`. Never starts or stops anything. |
| `drive-one.ps1` (default) | no* | Runs doctor, then `live-api-smoke.ps1` (GET recipe for all 6 features), then `live-web-smoke.cjs` (Playwright, one fresh context per feature, screenshots and `main` text). Supports `-Feature <name>`, `-SkipPlaywright`, `-Prefix`, and `-Ts`. |
| `drive-one.ps1 -RoleE2E -AllowMutation` | **yes** | Runs the repository runner `scripts\run-role-e2e.ps1`. Its `workflow-api-smoke.ps1` registers users and creates employees/bids/projects/subcontracts/pay-period config, and `e2e/tests/role-workflows.spec.ts` creates and advances bids, time, payroll runs, billing apps, change orders, RFIs, and daily reports. Use it only when the run owns the data. |

\* The only non-GET calls in the read-only smoke are logins, plus one demo-principal `POST /api/payroll/runs/generate` with an all-zero period ID. That call is expected to return `403 DEMO_READ_ONLY`.

## Operating loop

1. Run `doctor.ps1` before touching the UI, and again after any failed drive.
2. Confirm service ownership. If Docker/Postgres or a server wasn't started by this run, don't stop it. Record `/api/version`.
3. Pick one role and one feature, then run `drive-one.ps1 -Feature <name>` (or all). For the UI, sign in through `/login`: role buttons for the role keys, or the email form for other seeded users such as `mgr-payroll@demo.local`.
4. Assert visible content in `main`. Every dashboard page's `h1` is the "Pitbull" logo, so it proves nothing. Navigate by hrefs rendered in the UI, not by IDs from header-less API calls (`X-Company-Id` scope).
5. Report `PASS`, `FAIL`, or `verified-unreachable` (with the concrete prerequisite and route attempted) per feature, with role, URL, evidence path, and the first actionable error. Clean up only what this run started.

## Feature playbooks

See [`features/README.md`](features/README.md) for the index:

- [`login-explore-as-role.md`](features/login-explore-as-role.md)
- [`projects-workspace.md`](features/projects-workspace.md)
- [`time-tracking.md`](features/time-tracking.md)
- [`contracts-aia-billing.md`](features/contracts-aia-billing.md)
- [`daily-reports-field.md`](features/daily-reports-field.md)
- [`payroll-runs-union-certified.md`](features/payroll-runs-union-certified.md)

## Evidence convention

Use `C:\pitbull-private\.cursor\skills\verify-pitbull\evidence\` (git-ignored except its `.gitignore`). Keep screenshots and logs after a run, and never delete evidence during cleanup.