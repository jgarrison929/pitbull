---
name: verify-pitbull
description: Verify the Pitbull web UI end to end from a user's perspective, including role login, workspace projects, time tracking, contracts/AIA billing, field daily reports, and payroll runs/union/certified. Use this skill when checking a local Pitbull web UI change or running a controlled role-based smoke test with evidence.
---

# Verify Pitbull

Use this skill to verify the **Pitbull web UI** as a user would: start only the local services that are needed, enter through a known demo role, exercise one feature at a time, and save screenshots or other evidence under `C:\pitbull-private\.cursor\skills\verify-pitbull\evidence\`.

## Non-negotiable safety and scope

- Repository: `C:\pitbull-private`.
- Do **not** start Docker or run the full prove as part of authoring or a dry run. The authoring request explicitly says Docker is stopped. Start services only when a later verification run explicitly calls for it.
- Do not guess routes, selectors, role names, feature behavior, or script arguments. Inspect the running UI and the existing Playwright files in `e2e\` first.
- Docker/Postgres is shared. Do not double-drive the environment without separate ports or profiles. If ownership, ports, or session isolation are unclear, stop and refuse to risk corrupting the user's session.
- Never kill by bare process name. Cleanup may stop only processes or containers that this skill started and can identify as its own.
- Keep evidence. Save screenshots under `C:\pitbull-private\.cursor\skills\verify-pitbull\evidence\` and include the role, feature, and a PT timestamp in the filename when practical.

## Known local topology

These are the commands and URLs supplied by the interview; do not replace them with invented variants:

```text
cd C:\pitbull-private
docker compose up -d

dotnet run --project src/Pitbull.Api
# API: http://localhost:5081

cd src/Pitbull.Web/pitbull-web
npm run dev
# Web: http://localhost:3000
```

Health is unauthenticated at `http://localhost:5081/health/live`.

The demo password is `PitbullDemo2026!`. When Demo is enabled, the role-login API is `POST /api/auth/demo-role-login`. Known demo emails include `ceo@demo.local` and `pm@demo.local`; discover any additional available demo roles from the application rather than guessing.

Playwright lives in `e2e\`. The repository-provided role runner is `scripts\run-role-e2e.ps1`; the repository also provides `preflight.ps1`. Use their existing documentation/help and existing test conventions for arguments. Do not invent a second runner or a full-prove command.

## Operating loop

1. Run `doctor.ps1` before touching the UI. It checks Docker, port `5432`, API health on `5081`, and the web response on `3000`; it does not start anything.
2. Confirm service ownership and isolation. If Docker/Postgres or either local server was not started by this run, do not stop it during cleanup.
3. Choose one role and one feature. Login with the demo password only when Demo is enabled. Prefer the existing Playwright role flow in `e2e\` and `scripts\run-role-e2e.ps1`.
4. Drive with control helpers: stable labels/roles and existing Playwright helpers first; avoid arbitrary sleeps and avoid changing data unless the test explicitly requires it.
5. Capture evidence for the observed user-visible result in the feature directory under `evidence\`.
6. Report pass, fail, or blocked with the role, feature, URL, exact evidence path, and the first actionable error. Clean up only resources this run started.

## Feature playbooks

See [`features/README.md`](features/README.md) for the index:

- [`login-explore-as-role.md`](features/login-explore-as-role.md)
- [`projects-workspace.md`](features/projects-workspace.md)
- [`time-tracking.md`](features/time-tracking.md)
- [`contracts-aia-billing.md`](features/contracts-aia-billing.md)
- [`daily-reports-field.md`](features/daily-reports-field.md)
- [`payroll-runs-union-certified.md`](features/payroll-runs-union-certified.md)

## Evidence convention

Use `C:\pitbull-private\.cursor\skills\verify-pitbull\evidence\`. Preserve screenshots and logs after a run. If repository policy later requires ignoring generated evidence, add the narrowest applicable ignore rule without deleting existing evidence.

