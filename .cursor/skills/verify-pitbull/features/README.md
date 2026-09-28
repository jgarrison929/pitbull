# Pitbull verification feature index

Each playbook is a user-POV smoke-test guide. It deliberately records only the interview-known startup, login, health, Playwright, isolation, evidence, and cleanup facts; inspect the current UI and `e2e\` tests before choosing selectors or actions.

| Feature | Playbook | Primary question |
|---|---|---|
| Login / explore as role | [login-explore-as-role.md](login-explore-as-role.md) | Can a known demo role enter the Pitbull web UI safely and reach the role-appropriate starting point? |
| Projects / workspace | [projects-workspace.md](projects-workspace.md) | Can the role inspect the workspace/project surface without crossing tenant or role boundaries? |
| Time tracking | [time-tracking.md](time-tracking.md) | Can the role inspect the time-tracking flow and verify visible state changes without inventing data? |
| Contracts / AIA billing | [contracts-aia-billing.md](contracts-aia-billing.md) | Can the role reach the contracts/AIA billing surface and verify the user-visible billing state? |
| Daily reports / field | [daily-reports-field.md](daily-reports-field.md) | Can the role reach the field daily-report workflow and verify its visible result? |
| Payroll runs / union / certified | [payroll-runs-union-certified.md](payroll-runs-union-certified.md) | Can payroll generate -> approve -> export, resolve UnionPackage rates, produce certified WH-347, post GL idempotently, and label net as proxy without inventing tax rates? |

## Common run order

1. From `C:\pitbull-private`, run `.cursor\skills\verify-pitbull\doctor.ps1`.
2. If the doctor is blocked, do not start or stop anything; report the JSON-ish checks and fix the environment owner/ports first.
3. If a later run explicitly authorizes startup, use only the interview-known commands in `SKILL.md` and wait for the API health and web response.
4. Select one role and one feature, then use the existing `e2e\` Playwright conventions and `scripts\run-role-e2e.ps1`.
5. Save evidence beneath `.cursor\skills\verify-pitbull\evidence\` and keep it.

## Result format

Report: `PASS`, `FAIL`, or `BLOCKED`; role/email; feature; URL; steps actually taken; evidence path; and cleanup ownership. Do not report a feature as passed merely because the page loaded.
