# Pitbull verification feature index

Each playbook is a user-POV smoke guide with source citations (re-verified against `origin/main` 3.8.2 on 2026-10-08) and a read-only live recipe. `drive-one.ps1` runs all six recipes, or one with `-Feature <name>`.

| Feature | Playbook | Primary question |
|---|---|---|
| Login / explore as role | [login-explore-as-role.md](login-explore-as-role.md) | Can a known demo role enter the web UI via `/login` and land on a usable, role-appropriate dashboard? |
| Projects / workspace | [projects-workspace.md](projects-workspace.md) | Can the role list projects and open a project dashboard within its company scope? |
| Time tracking | [time-tracking.md](time-tracking.md) | Can the role reach crew entry and the PM time review queue and see real entries without changing them? |
| Contracts / AIA billing | [contracts-aia-billing.md](contracts-aia-billing.md) | Can the role see owner contracts, billing applications, and a G702 summary, plus subcontracts? |
| Daily reports / field | [daily-reports-field.md](daily-reports-field.md) | Can field leadership reach the mobile Field report wizard and a project's Daily Reports log? |
| Payroll runs / union / certified | [payroll-runs-union-certified.md](payroll-runs-union-certified.md) | Can the payroll manager see runs, run detail, certified WH-347, and demo read-only enforcement? Union catalog, prevailing-wage, GL post, and `netIsProxy` exist only on PR #583. |

## Common run order

1. From `C:\pitbull-private`, run `.cursor\skills\verify-pitbull\doctor.ps1`.
2. If the doctor fails, don't start or stop anything you don't own. Report the JSON checks and fix the environment owner/ports first.
3. If the run authorizes startup, use only the commands in `SKILL.md`, wait for API health and the web response, and record the PIDs you started.
4. Run `.cursor\skills\verify-pitbull\drive-one.ps1 [-Feature <name>] -Prefix <prefix>`. It is read-only by default. The mutating role runner needs `-RoleE2E -AllowMutation`.
5. Evidence lands under `.cursor\skills\verify-pitbull\evidence\`. Keep it.

## Result format

Report `PASS`, `FAIL`, `BLOCKED`, or `verified-unreachable` (with the prerequisite and the route attempted), plus the role/email, feature, URL, steps actually taken, evidence path, and cleanup ownership. A page that merely loaded is not a pass. Assert the visible content.