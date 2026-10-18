# Pitbull 5.0.0: fresh-start plan

Status: decisions locked 2026-10-18 (PT). M0 (repo side) landed with this doc: tag `legacy-3.8.2-final`, the `v5/` scaffold with its Railway config, and v5 jobs inside `ci-gate`. The staging repoint and the v5 verification skill finish M0.
Decision context: Joshua chose to start over after looking at the live app. A recent prospect picked InEight over us; the read is they did not trust what we can deliver. 5.0.0 exists to fix trust, not to add breadth.

## 1. Where the old app stands (evidence snapshot)

Evidence: a read-only headless Playwright crawl of both Railway environments on 2026-10-18, logging in through the public demo role buttons. It saved a per-page table and screenshots, which are not committed. The crawl was stopped early when the restart was decided, so it graded page loads only. No create flows ran.

Deployed state (Railway project `dependable-heart`):

| Env | Web | API | Build | Notes |
|---|---|---|---|---|
| production | demo.pcserp.app, app.pcserp.app | api.pcserp.app | 3.8.2 @ `88a686d3` (branch `production`, deployed 2026-10-05 14:47 PT) | main is 13 commits ahead |
| staging | pitbull-web-staging.up.railway.app | pitbull-staging.up.railway.app | 3.8.2 @ `4090148f` (main, 2026-10-18 13:19 PT) | the two newer main commits (`0387108`, `01f53bf`) have been stuck in WAITING since 13:35 / 13:45 PT |

Services per env: `pitbull` (.NET API), `pitbull-web` (Next.js), `Postgres` (5 GB volume). `/health/live` = 200 Healthy, `/api/version` reports the commit.

Crawl totals (6 demo roles via the login role buttons, CEO given the full 80-route nav list plus 17 project tabs):

- prod: 153 page visits: 108 load clean, 35 empty, 6 placeholder, 4 with API errors.
- staging (main): 154 visits: 97 clean, 30 empty, 21 with API errors, 6 placeholder.

Worst failures:

1. The documented demo password (`PitbullDemo2026!`) returns 401 on both envs, so the payroll, AP, AR and field-engineer personas can't be reached from the public demo. Only the 6 role buttons work, and they share a limit of 10 logins per hour per IP.
2. Main has regressed against prod. On staging the CEO gets 403 on 10 finance and payroll pages (journal entries, periods, bank rec, retention, lien waivers, payroll runs/certified/exports/reviews/wage determinations) that load in prod. PM and superintendent get 403 on project RFIs. `cost-predictions` returns 404 on project overview.
3. Job cost, the 4.0.0 must-win, calls `cost-to-complete` and gets 400 on both envs.
4. The demo story doesn't hold together. The PM dashboard shows 14 active projects, 10 open RFIs, 23 pending submittals and 71 or 72 pending approvals (two numbers on one screen). The first project in the list shows "No … yet" on 14 of its 17 tabs (daily reports, RFIs, schedule, submittals, change orders, etc.).
5. The dashboard shows developer text to users ("Expanded lifecycle: timeEntries … (2.21.3 freeze)"), and `/help` has placeholder text.

Size of what we're leaving: about 96k lines of C# (excluding about 1.06M lines of EF migrations), 129k lines of web TypeScript, 163 pages, 103 controllers, 80 nav routes, 15 C# modules. Tests: 3,224 xUnit unit, 305 integration, 423 vitest, 20 Playwright. A large surface with thin seed data and weak runtime proof: most pages load, but few tell a demo-able story. That matches Joshua's verdict.

## 2. Trust bar (5.0.0 must pass all of it)

That prospect bought InEight's credibility and platform direction. Every item below is a release gate, not a goal:

1. **Every click works.** The shipped UI has no stubs, "coming soon", placeholders, empty modules or dev text. If a feature isn't excellent, it isn't in the nav. CI enforces this: a Playwright crawl walks every nav link for every demo role and fails on any 4xx/5xx, error boundary, empty state on seeded data, or banned string.
2. **Seeded, resettable demo data.** Each demo visitor gets their own sandbox company, cloned from a deterministic seed at login and expired after 24 h. Create and edit flows are safe to click, and nothing a visitor does breaks the next demo. A "Reset demo" button reseeds the sandbox in seconds.
3. **Visible proof.** A public `/status` page shows the deployed version, commit, CI gate result, and the date of the last verify run. Each release carries release notes and a link to its verify evidence. A public changelog lives in the app.
4. **Steady releases.** A fixed cadence (for example every two weeks), and every release is a demo-able increment. Nothing is announced before it passes the gate.
5. **Enterprise-grade UI.** One design system, dense but calm tables, consistent page anatomy (header, KPI strip, primary table/chart, detail drawer), light and dark themes, and a designed empty state for each list (not reachable with seed data, but designed anyway).
6. **Coherent platform story.** One spine (estimate → budget → field progress → cost and earned value → change), one data model, and a public roadmap (section 9) that names what comes next and in what order.

## 3. Positioning vs InEight (cited)

What InEight is, from its public pages:

- A "modular, integrated project controls platform designed for capital construction" that connects "estimating, scheduling, cost, contracts, change, progress tracking, document control, and analytics" (https://ineight.com/faq/).
- Modules: Control, Contract, Change, Plan & Progress, Estimate, Schedule, Document, Model, Report & Explore (https://ineight.com/integrated-project-controls-software/, https://ineight.com/products/), plus Compliance for safety, quality and environmental forms (https://ineight.com/products/ineight-compliance/).
- Its pitch: "Create construction budgets directly from estimates and forecast remaining work … by incorporating actual data from the field and your financial system", and it is "the preferred choice for mega projects". Markets: construction/engineering, transportation, power, nuclear, water, oil and gas, mining (https://ineight.com/products/).
- The field-to-office loop: work packages and daily plans go to the foreman's device. The foreman enters crew hours and installed quantities and sees gain/loss against budget. A superintendent approves; hours go to payroll and quantities sync to Control (https://learn.ineight.com/Plan/Content/Video-search/InEight-Plan-and-Progress-Overview-video.htm, https://learn.ineight.com/Progress/Content/Administration/1-Overview/1%202%20InEight%20Progress%20Overview.htm). WBS elements link Progress quantities and hours to Control cost items (same Progress page).
- Earned value: EV = PV × % complete, tracked for cost and man-hours against the current estimate and current budget (https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/1%20Measurement/2.1.2%20OverviewMeasurement.htm). Forecast methods are set per cost item: current budget, current estimate, average performance, committed cost, manual, rollup, and others (https://learn.ineight.com/Control/Content/2-Progress%20and%20Forecasting/3%20Forecasting/2.3.3%20ForecastMethods.htm).

Our reading (inference, not an InEight claim): its strength is the closed loop. The estimate becomes the budget, the field claims quantities and hours against the same cost items, and Control turns that into earned value and forecasts. 5.0.0 copies that loop at small scale, for mid-size heavy-civil and commercial contractors, with a faster and better-looking demo.

| InEight module | What it does (per sources) | Our phase |
|---|---|---|
| Estimate | Consistent, competitive bids | **5.0.0**: cost-item estimate, approve to budget |
| Control | Budgets, forecasts, actuals, EV | **5.0.0**: cost and EV dashboard, 2 forecast methods |
| Plan & Progress | Work packages, daily plans, quantities and hours from the field | **5.0.0**: daily plan/report with quantities and hours, approval |
| Change | Repeatable change-order workflow | **5.0.0**: change orders that revise the budget |
| Schedule | CPM, risk analysis | 5.1: activities, Gantt, CPM-lite; PV from schedule |
| Contract | Centralized, ERP-integrated contracts | 5.2: subcontracts and commitments, committed-cost forecast |
| Document | Auditable document control | 5.3: drawings, specs, transmittals, revisions |
| Compliance | Safety, quality, environmental forms, mobile | 5.4: form builder, inspections, incidents |
| Report & Explore | Portfolio dashboards | 5.0.0 starts it (portfolio EV); 5.5 broader |
| Model | 3D models with live data | Not planned (needs its own decision) |

## 4. 5.0.0 core: the smallest credible InEight-style story

One demo, start to finish in about 5 minutes. Every step is seeded, and the next step's data comes from the previous one:

1. **Login as a role** (role cards, no password). Each visitor gets a sandbox company.
2. **Projects portfolio**: 3 seeded heavy-civil projects at different stages (just awarded, mid-construction, near completion), each with KPIs (budget, EAC, CPI, SPI, % complete).
3. **Estimate → Budget**: a project's estimate is a list of cost items under a WBS (cost code tree) with quantity, unit, man-hours, labor/material/equipment/sub unit costs. "Approve estimate" freezes it as the Original Budget. Current Budget = original + approved changes. CSV import of cost items.
4. **Field daily plan/report** (mobile-first): the superintendent picks today's cost items and crew. The foreman enters hours per worker per cost item and the installed quantity per cost item, and sees gain/loss live (earned hours vs actual hours). Then submit, and the superintendent approves or returns it. Approved quantities and hours post to the cost items.
5. **Cost and earned value**: per project and portfolio. PV (time-phased linearly between each cost item's planned start and finish), EV (budget × quantity % complete), AC (hours × crew rates + equipment + cost entries), CPI/SPI, EAC/ETC with a per-item forecast method (current budget or average performance, both from the InEight method list above), and an S-curve chart. Drill-down from project to WBS to cost item to daily reports.
6. **Change orders**: a PCO is raised with cost-item impacts, priced, approved by the PM or executive, and the approval revises the current budget and forecast. Each step has an audit trail.

Cross-cutting: an audit log for every state change, `/status` and changelog pages, and a demo reset.

Explicitly out of 5.0.0 (on the roadmap, never shown as stubs): scheduling beyond planned dates, subcontracts, AP/AR, owner billing and pay apps, payroll, documents, RFIs, submittals, compliance forms, AI, digital twin, integrations, multi-company admin.

Demo roles (4):

| Role | Lands on | Owns in the story |
|---|---|---|
| Executive | Portfolio EV | Approves big COs, reads CPI/SPI across jobs |
| Project Manager / Project Controls | Project cost and EV | Estimate → budget, change orders, forecasts |
| Superintendent | Today's daily plans | Plans the day, approves field reports |
| Foreman (mobile) | Today's plan on phone | Enters hours and quantities |

The Estimator is folded into PM for 5.0.0 to keep the role surface small.

## 5. Stack

Recommendation: **one TypeScript app, Next.js 16 (App Router, server actions and route handlers) + Postgres + Drizzle ORM, deployed as a single Railway service.** This drops the separate .NET API.

Why it beats keeping .NET 10 + Next.js for this goal:

- **One contract, no drift.** Several of the worst live failures are seams between web and API: pages calling endpoints that answer 400, 403 or 404 for the same role. One typed codebase (Drizzle schema → zod → server actions) removes that class of bug.
- **Half the CI and deploy surface.** One build, one test runner family (vitest + Playwright), one Railway service (the reused staging web service) plus a database on the existing Postgres. Agents change features in one place.
- **It fits the domain math.** EV, forecasts and gain/loss are arithmetic over a few thousand rows per project. Use integer cents and integer milli-quantities, no floats.
- **Lower maintenance.** The old repo spent recent weeks on NuGet and npm advisory churn in two ecosystems.

When to keep .NET instead: if Joshua wants the old C# domain code ported as-is, or needs .NET for a specific enterprise integration. Neither is needed for 5.0.0, and the old code isn't being reused verbatim (section 8). The repo, Railway and Postgres stay the same.

Supporting choices: Auth.js-free custom session (signed httpOnly cookie, users table, role on membership). Demo login is a role-card server action, so no rate-limited password flow. Tenancy is a `company_id` on every row, enforced in one data-access module (and Postgres RLS later if needed). Migrations: drizzle-kit, run on deploy. Jobs: none in 5.0.0 apart from the sandbox expiry sweep (a Railway cron service or on-login cleanup).

## 6. UI approach

- **shadcn/ui (Radix + Tailwind v4)** as the component base, with our own theme tokens (one accent, neutral grays, 8-pt spacing, Inter or Geist font). The components live in-repo (`components/ui`) so agents can read and change them.
- **TanStack Table** for every grid (sticky header, column pinning, numeric right-align, totals row), **Recharts** (via shadcn charts) for S-curves and KPI sparklines, `sonner` for toasts, `lucide-react` icons. No emoji icons.
- Page anatomy is fixed by a few layout components (`PageHeader`, `KpiStrip`, `DataTable`, `DetailDrawer`, `EmptyState`) so every screen looks related. The foreman's mobile view is designed for phones first (large tap targets, offline-tolerant form).
- Visual QA: Playwright screenshot baselines for each role landing and each core page in light and dark themes, reviewed in PRs.

## 7. Repo layout, CI, Railway

**Repo layout: new top-level `v5/` directory on `main`.** Old code stays in place until cutover, then is archived.

- Rejected: a long-lived rebuild branch (drifts, can't auto-merge to main, CI confusion) and a new repo (ruled out).
- At M0, tag `legacy-3.8.2-final` on the current production commit. At cutover, a PR deletes `src/`, `tests/`, `e2e/`, legacy `docs/` and workflows, and moves `v5/*` to the root (or keeps `v5/`, whichever reads simpler; decide at cutover). The old app stays recoverable from the tag.

**CI: one required check, `ci-gate` (landed in #610).**

- The `v5` job runs on `v5/**` changes: install → lint → typecheck → vitest → drizzle migrate against a Postgres service container → seed → `next build` → Playwright (demo journey per role + the full nav crawl from the trust bar + screenshot baselines). The existing `ci-gate` job aggregates these with the legacy jobs and stays the only required status check.
- Both live in `ci.yml`. Its `changes` job routes PRs: legacy jobs run only when files outside `v5/` change, and v5 jobs run when `v5/**` or `ci.yml` changes. `ci-gate` always reports, so the required check never sits pending.
- Branch ruleset: require `ci-gate`, squash only, auto-merge allowed, no required human review (the agent-friendly part). Agents open PRs with `gh pr merge --auto --squash`.
- Release: tag `v5.x.y` → GitHub release notes generated from conventional commits → the changelog page reads the same file.

**Railway topology: reuse, no new services** (project `dependable-heart`, decided 2026-10-18):

| Service | Env | Runs | Domain |
|---|---|---|---|
| `pitbull-web` | staging | **v5** from `main`, root directory `/v5` | pitbull-web-staging.up.railway.app |
| `Postgres` | staging | the existing instance, plus a separate database `pcs_v5` for v5 | private network only |
| `pitbull` (API) | staging | legacy, idle once the web points at v5; retire it later | pitbull-staging.up.railway.app |
| `pitbull`, `pitbull-web`, `Postgres` | production | legacy 3.8.2 until cutover | demo.pcserp.app, app.pcserp.app, api.pcserp.app |

There are no PR or preview environments. CI (`ci-gate`) is the per-PR proof, and staging is the shared running app.

Repoint runbook for staging `pitbull-web` (a Railway write; do it after the M0 PR merges):

1. Create the database: `CREATE DATABASE pcs_v5;` on the staging Postgres.
2. Service settings: Root Directory `/v5`, and Config File Path `/v5/railway.toml`. Railway does not look inside the root directory for config, and the repo-root `railway.toml` forces the legacy Dockerfile builder. `v5/railway.toml` sets the Railpack builder, `npm run build`, `npm start`, healthcheck `/health`, and watch pattern `/v5/**`.
3. Variables: set `DATABASE_URL=postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/pcs_v5`. Remove `RAILWAY_DOCKERFILE_PATH`, `RAILWAY_HEALTHCHECK_PATH` and the legacy `NEXT_PUBLIC_*` variables. Railpack derives Node 24 from `engines`/`.nvmrc` and npm 11 from `packageManager`. Its install step sets `NPM_CONFIG_PRODUCTION=false`, so the build-time dev dependencies (Tailwind, shadcn CSS) are installed. Railway provides `PORT` and `RAILWAY_GIT_COMMIT_SHA`.
4. Keep "wait for CI" on, so staging only deploys commits where `ci-gate` is green. The two legacy staging deploys stuck in WAITING on 2026-10-18 should be checked here first.
5. Verify: run the v5 verification skill against pitbull-web-staging.up.railway.app. `/status` shows the deployed commit with Database `ok`.

Config-as-code (`railway.toml`) is deprecated, with a hard cutoff on 2026-12-01 (https://docs.railway.com/config-as-code). Before then, move these settings into Railway's replacement (`.railway/railway.ts`) or into the service settings. That is an M1-era task.

- Deploy healthcheck: `/health` pings the DB and returns version, commit and build time (503 when a configured DB is down). `/status` shows the same.

## 8. Demo data and what we reuse

Seed strategy:

- One deterministic TypeScript seed module (`v5/src/seed/`). It builds one demo company ("Summit Highway & Bridge", a heavy-civil archetype reused from `docs/DEMO-COMPANY-PROFILES.md`) with 3 projects, a WBS of about 40 to 80 cost items each, crews and rates, 30 to 60 days of approved daily reports on the active jobs, and 4 to 6 change orders in mixed states. EV is deliberately varied: one job ahead of plan, one behind on cost, one behind on schedule.
- The seed is a pure function `(companyId, today) → rows`, with dates relative to today so the demo never looks stale. The same function seeds CI, staging, and each visitor sandbox.
- A unit test asserts the story invariants (each project has non-empty EV, at least one pending CO, today's plan exists for the superintendent), so the trust bar can't regress silently.

Reuse from the old code: **ideas and specs, not code**.

- Domain vocabulary and fields from `Pitbull.Projects`, `Pitbull.TimeTracking` (crew entry), `Pitbull.ProjectManagement` (daily reports), `Pitbull.Contracts` (change-order states), and cost-code lists from the seed services.
- The demo company profiles and persona descriptions (`docs/DEMO-COMPANY-PROFILES.md`, `docs/ROLE-EXPERIENCE.md`).
- Specs and acceptance notes: `docs/specs`, the job-cost glance band, the mobile daily-report offline-queue behavior, and the legacy inventory in `docs/roadmap-5.0.0.md` history (PR #607) as a record of what not to rebuild.
- The verify-pitbull skill structure (feature playbooks + driver + evidence), rewritten for Linux and Node and pointed at `v5/`. The audit's crawler (role-button login, visit every nav link, flag 4xx/5xx, error text, empty states) is the starting shape for the nav-crawl gate.
- Infrastructure: the Railway project, the domains, and the Postgres template.

Not reused: C# modules, EF migrations, the 163-page web app, the RBAC permission matrix (5.0.0 has 4 roles with fixed capabilities).

## 9. Milestones (each shippable and verifiable)

Each milestone merges through `ci-gate`, deploys to staging, and ends with a run of the v5 verification skill whose evidence is linked in its release notes. Production stays on legacy 3.8.2 until M6. Review effort goes into what gets built (diffs, running app, evidence), not adversarial review of this plan.

- **M0: Subtract and set the rails** (about 1 day).
  - Repo half (landed with this doc): tag `legacy-3.8.2-final` on `88a686d3` (v3.8.2, what production runs). The `v5/` scaffold (`/status`, `/health`, `v5/railway.toml`). v5 jobs aggregated into the existing required check `ci-gate`. Legacy features frozen (security fixes only).
  - Railway half: the repoint runbook in section 7.
  - A v5 verification skill: driver script plus playbook, Linux and Node, evidence saved per run. Its first flow drives the running staging app and proves `/status` loads with the deployed commit and DB `ok`, with a screenshot and the JSON from `/health` as evidence.
  - *Done when:* the verification skill has passed once against staging, with evidence. No autonomous loops run on v5 until then.
- **M1: Shell, login, sandbox, portfolio.** First, build 2 or 3 working prototypes of the app shell behind a switcher on staging, including a screen-first shell (sidebar, tables, dashboards) and a chat/voice-first agentic shell (ask, dictate a daily report, act from conversation). Send screenshots to Joshua and let him pick. Until he picks, the stack and UI choices in sections 5 and 6 are provisional. Then build on the chosen shell: design-system tokens and layout components, role-card login, per-visitor sandbox seeding plus reset, projects portfolio with KPIs, `/status` and changelog pages. *Verify:* Playwright logs in as all 4 roles, the nav crawl is clean, screenshot baselines are approved.
- **M2: Estimate → Budget.** WBS and cost items, CSV import, approve to budget, budget views. *Verify:* PM imports a CSV, approves it, and the budget totals match a fixture.
- **M3: Field daily plan/report.** Superintendent plans the day, foreman fills in hours and quantities on mobile with live gain/loss, submit, approve or return, then posting. *Verify:* a mobile-viewport e2e from plan to approval, and the posted quantities show on the cost items.
- **M4: Cost and earned value.** PV/EV/AC, CPI/SPI, EAC with 2 forecast methods, S-curve, portfolio rollup, drill-down. *Verify:* unit tests for the EV math on a hand-computed fixture, and e2e numbers matching the seeded expectations.
- **M5: Change orders.** PCO → priced → approved → revises the budget and forecast, with audit trail. *Verify:* e2e where the executive approves and EAC and the current budget move by the exact amount.
- **M6: Trust pass and 5.0.0 cutover.** Full nav crawl with zero findings, visual review, perf budget (each page under 1.5 s on staging), release notes. Then move demo.pcserp.app and app.pcserp.app to the v5 service (promoted from staging the same way) and the legacy web to legacy.pcserp.app, and watch for 48 h. Then the cleanup PR removes legacy code from `main` (recoverable from the tag), and later the legacy Railway services are retired with Joshua's sign-off. *Verify:* the crawl and journeys pass against the production domain after the domain move.

Post-5.0 map toward InEight parity (north star, one module per release, each held to the same trust bar):

| Release | Module | Builds on |
|---|---|---|
| 5.1 | Schedule: activities, Gantt, dependencies, CPM-lite; PV from schedule instead of linear | M4 PV |
| 5.2 | Contracts and subs: subcontracts, commitments, committed-cost forecast method, sub change orders | M5 change orders |
| 5.3 | Document control: drawings and specs with revisions, transmittals, RFIs and submittals tied to documents | projects |
| 5.4 | Compliance: form builder, inspections, incidents, mobile offline capture | M3 mobile |
| 5.5 | Owner billing (AIA G702/G703) and portfolio reporting | budget + progress |
| 5.6+ | ERP and payroll export (approved hours), work packaging, estimating depth (resources, assemblies) | M3, M2 |

## 10. Decisions (locked 2026-10-18)

- Stack: a single Next.js 16 + Postgres + Drizzle app in `v5/` (npm, Node 24 LTS).
- Demo archetype: heavy-civil.
- Repo: the `v5/` folder on `main`. Legacy tag `legacy-3.8.2-final`.
- Railway: no new services. v5 reuses the staging `pitbull-web` service, with a separate `pcs_v5` database on the existing staging Postgres. The staging API is retired later. Production stays on 3.8.2 until cutover. No preview environments.
- The shell (screen-first or chat/voice-first) is picked from the M1 prototypes, so sections 5 and 6 are provisional until then.
