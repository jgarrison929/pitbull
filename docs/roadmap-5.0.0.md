# Roadmap 5.0.0

Status: first draft, inventory only. No code was removed for this doc.

## Goal

5.0.0 ships only features with evidence that they work. Anything broken, unwired, stubbed, or without a path to working gets cut in its own PR. This doc is the inventory those PRs work from.

Every row below is one of three verdicts:

- **Keep.** There is current runtime evidence (a CI smoke on main or an integration test that ran green on main) that the feature works end to end.
- **Verify.** The code is wired and has tests, but nothing proves the user path today. It needs a `/verify-pitbull` run or a CI smoke before 5.0.0.
- **Cut candidate.** Static evidence says it is a stub, unreachable, or dead. Each one needs a cut PR or a reason to stay.

## Evidence used

Inventory of `main` at `72590e28` (3.8.2 plus #599), taken 2026-10-18.

| Source | Result |
|---|---|
| CI on main, last green run | `88a686d3` (3.8.2), 2026-10-05. .NET unit and integration tests, frontend build, Role E2E smoke (L4 owner billing only), mobile field report smoke, and owner signup smoke all passed. |
| CI on main now | Red since 2026-10-15 (`72590e28`). `Build & Test (.NET)` fails restore with NU1902/NU1903 on `System.Security.Cryptography.Pkcs` and `.Xml` 10.0.11 (warnings as errors). The three Playwright smokes are skipped. A separate fix is in flight. |
| Unit tests, local | `dotnet test tests/Pitbull.Tests.Unit -p:NuGetAudit=false`: 3683 passed, 0 failed, 2 skipped (`CompanyIsolationTests`, InMemory limitation). |
| Web tests, local | `npx vitest run`: 94 files and 443 tests passed. 2 files did not start because the box has Node 20 and undici 8 needs a newer runtime. CI uses its own Node version. |
| Integration tests, local | Not run (no Docker on the inventory box). |
| `/verify-pitbull` | Not on main yet (PR #584). It has playbooks for login and Explore-as-role, projects workspace, time tracking, contracts and AIA billing, field daily reports, and payroll runs. Its scripts are PowerShell with Windows paths, so the doctor step was not run here. |
| Static scans | DI and route registration in `Program.cs`, controller routes against web callers, page routes against nav and inbound links, and `TODO`, `stub`, `NotImplementedException`, and "coming soon" markers. |

Stack note: the repo targets .NET 10 (`net10.0`, SDK 10.0.100 in `global.json`), not .NET 9.

## Inventory

### Keep

| Feature | Evidence |
|---|---|
| Auth, login, demo Explore-as-role | `AuthEndpointsTests`, `AuthRbacJwtTests`, `AuthFlowTests` (integration). The L4 smoke signs in through the `setup-roles` project. |
| Owner self-service signup and company provisioning | `owner-signup` smoke green on `88a686d3`. `OwnerSignupIntegrationTests`. |
| Projects create, list, and workspace | `ProjectsEndpointsTests` (integration). The L4 smoke runs inside a project. |
| Owner billing (AR, `BillingApplication`, G702/G703) | Role E2E smoke `L4 Owner billing: PM creates app, AR certifies via UI` green on `88a686d3`. |
| Field daily report on mobile, with offline queue | `mobile-field-report` smoke green on `88a686d3`. `DailyReportsEndpointsTests` (integration). |
| Multi-company isolation and RLS | `MultiCompanyIsolationTests` (integration). |
| Health and version endpoints | `HealthEndpointsTests` (integration). `/api/version` reports commit and build date since #596. |

### Verify

Every row here is wired into DI, routing, and nav. Most have unit tests that pass locally. None has a current runtime proof.

| Feature | What exists | How to prove it |
|---|---|---|
| Bids | `BidsEndpointsTests`, role E2E L1 | Run L1 or add it to the CI smoke |
| Cost codes, phases, project setup chain | `CostCodesEndpointsTests`, role E2E L2 | L2 |
| Time tracking capture, crew entry, approval | `TimeEntriesEndpointsTests`, `TimeEntryReviewIntegrationTests`, role E2E L3 | L3, verify-pitbull `time-tracking` |
| Payroll on main: runs, pay periods, certified WH-347, exports, reviews, wage determinations | `PayPeriodsEndpointsTests`, role E2E L3b, unit tests | L3b, verify-pitbull `payroll-runs-union-certified` (main-only items) |
| Subcontractor pay apps (AP, `PaymentApplication`) | `PaymentApplicationsEndpointsTests`, role E2E L5 | L5 |
| Change orders, subcontract and owner | `ChangeOrdersEndpointsTests`, role E2E L6 and L6b | L6 |
| RFIs | `RfisEndpointsTests`, role E2E L7 | L7 |
| Submittals | `SubmittalsEndpointsTests`, role E2E L8 | L8 |
| Vendor invoices and vendor payments | Role E2E L9 covers invoices. No tests reference `VendorPayment`. | L9, plus one payment path |
| Daily report approval on desk (submit, approve, lock) | Role E2E L10 | L10, verify-pitbull `daily-reports-field` |
| Job cost glance (4.0.0 must-win) | `JobCostEndpointsTests`, `GET /api/projects/{id}/job-cost/glance` | Add a smoke for the PM and field tab |
| Schedule, tasks, Gantt and Kanban glance, CPM | `ScheduleEndpointsTests`, `TasksEndpointsTests` | verify-pitbull `projects-workspace` |
| Contracts, subcontracts, SOV, retention | `SubcontractsEndpointsTests`, unit tests | verify-pitbull `contracts-aia-billing` |
| Employees, onboarding wizard, CSV import | `EmployeesEndpointsTests` | One create and one import run |
| Equipment | `EquipmentEndpointsTests` | One list and edit run |
| Accounting GL: chart of accounts, journal entries, periods, trial balance, financial statements, bank reconciliation | Unit tests for journal entries and bank reconciliation. No tests reference `FinancialStatement`. | Post one journal entry and read the trial balance and income statement |
| Reports: aging, WIP, labor cost, project profitability, weekly summary, PDF | Unit tests. `WipReportsController` has one test reference. | Open each report with seeded data |
| Purchase orders | Unit tests only | One PO create |
| Customers, vendors, compliance docs (COI expiry), lien waivers on desk | Unit tests only | One run per list page |
| Documents, files, plans and specs viewer (S3 storage) | Unit tests, `PlanSheet` web tests | Upload and open one sheet |
| PM paper: punch list, meetings, communications, narratives, site walk, progress, projections, earned value | Unit and web tests. No integration or E2E tests. | verify-pitbull playbooks still to write |
| Workflow approvals and My Approvals | `WorkflowApprovalTests`, `WorkflowGapEvidenceTests` | Approve one change order in My Approvals |
| Role dashboards, briefing, Today on site | `DashboardEndpointsTests` | verify-pitbull `login-explore-as-role` |
| Search and command palette | Unit and web tests | One search per entity type |
| Notifications, `DeadlineCheckService`, email | Unit tests. Email is Resend in production and a console stub in development. | Trigger one notification and confirm delivery |
| Admin: users, roles, company, audit log, API keys, secrets, tax settings, module settings, feedback | `AdminUsersEndpointsTests`, `AdminCompanyEndpointsTests`, `AdminAuditEndpointsTests` | Admin walkthrough |
| Admin health pages: health dashboard, system health, diagnostics, Hangfire dashboard | Unit tests | Open each page. Four health views overlap and should become one. |
| Data import and QuickBooks/Vista export | Unit tests (`IntegrationExportService`) | Export one IIF and one CSV file and open them |
| Help center, glossary, changelog | Web tests | Page load |
| Hangfire jobs: `PdfGenerationJob`, `AiBatchProcessingJob` | Unit tests. Started only by `POST /api/jobs/enqueue` (SystemAdmin), which the web never calls. | Decide with the AI row |
| AI: chat, document, field voice, suggest, usage, cost to complete, invoice extraction, delivery ticket OCR | Unit tests, `FieldVoiceSuggestionEndpointTests`. Every call needs an Anthropic or OpenAI key. | Needs a product decision (see below) |
| PWA shell and service worker | `ServiceWorkerRegister` in the web layout. No test asserts install or offline behavior. | Add an assertion to the mobile smoke |

### Cut candidates

| Item | Evidence | Proposed cut |
|---|---|---|
| Digital twin model conversion and photo pins | `SpatialService.cs:431` and `:542`: "Stub job: only Pending → Processing. Never mark Succeeded here." `Interfaces.cs:238`: photo pins return empty. `docs/gtm/gc-tool-replacement-4.0.0.md` already cuts the twin as a sell gate. | Remove conversion and photo pin endpoints and UI. Decide separately on zones (see decisions). |
| `WeatherUpdateJob` and `WeatherController` | The job calls Open-Meteo every 6 hours for every active project with GPS, then only logs the result. It does not persist or cache anything. The web never calls `/api/weather`. | Delete the job, its recurring registration, and the controller |
| Vendor portal (`/portal/[token]`, `VendorPortalController`) | No web page, E2E test, or script calls `POST /api/vendor-portal/tokens`, so no vendor can get a link. No integration or E2E tests. | Remove the portal pages and controller, or add a token UI and a smoke |
| Empty projects `Pitbull.Portal`, `Pitbull.Email`, `Pitbull.Messaging` | 0 `.cs` files each. Referenced only by `Pitbull.Api.csproj`, `Pitbull.sln`, and an architecture test list. | Remove the projects and their references |
| "Require lien waiver before paid" setting | `PaymentApplicationService.cs:274` always fails with "Lien waiver tracking is not yet available" when the flag is on, even though `LienWaiversController` exists. Its page `/settings/payment-applications` has no inbound link. | Remove the flag and page, or check real lien waivers |
| Unlinked pages | `/admin/components-showcase`, `/marketing/comparison`, and `/time-tracking/print` have no inbound links. `/project-management/tasks/my` links only to itself. | Remove |
| Employee onboarding settings | `/settings/employee-onboarding` has no inbound link. The web never calls `EmployeeOnboardingSettingsController`. | Remove the page and controller, or link it from settings |
| Migration accelerator (`/admin/migration`) | Not in nav. Only its own pages link to it. Overlaps `/admin/data-import`. | Remove, or merge into data import |
| API controllers with no caller | `BillingPeriodsController` (5 endpoints), `TenantsController` (3), and `MonitoringController` (3) have no caller in web, E2E, or scripts. Monitoring overlaps the admin health pages. | Remove, or document an external caller |
| "Coming soon" UI | Disabled equipment bulk import button (`equipment/page.tsx:588`), logo upload that only shows a toast (`admin/company/page.tsx:722`), and "tracking and expiration dates coming soon" on employee certifications. | Remove the controls and copy |
| Repo clutter | `check-rls-tables.sql` and `debug-rls.sql` at the root have no references. One `coverage/*.cobertura.xml` file is committed. | Delete. Move `test-rls.sql` under `docs/security` or delete it. |
| Superseded planning docs | `docs/ROADMAP-2.1.md`, `docs/roadmap/*`, `docs/260712`, and `docs/340-pm-arc` describe 2.x to 4.0 bands. This file replaces them as the active plan. `PmNextgenArcDocsTests` and `FinancialMathArcDocsTests` assert many of these files exist. | Archive or delete after this doc merges, and update those tests in the same PR |

### Open work outside main

| Item | State |
|---|---|
| PR #583 `payroll: P0–P3 module, union rates, certified, tax adapter, GL post` | Open since 2026-09-28. +84,483 / -1,197 lines in 146 files. `Build & Test (.NET)` and `Build Frontend` are red on its last run. Not part of the 5.0.0 inventory until a decision is made. |
| PR #584 `chore(verify): add project-local verify-pitbull skill` | Open. Required for the release bar below. |

## Open decisions

- **PR #583 payroll.** It is 84k lines, red, and three weeks stale. The 4.0.0 GTM map already cuts payroll as a sell gate. Proposed: close it for 5.0.0 and re-land union rates, certified submit, and GL post later as small PRs, each with a verify playbook.
- **AI features.** Every AI endpoint needs a tenant provider key, and nothing proves one works today. Proposed: hide AI in 5.0.0 unless one feature (field voice or invoice extraction) gets a green verify run with a real key.
- **Digital twin zones.** Conversion and photo pins are stubs, but the daily report zone picker reads twin zones and has an E2E spec. Proposed: keep zones as plain project locations and cut the rest of the twin.
- **Vendor portal.** Proposed: cut it. Wiring it needs a token UI, email delivery, and a smoke, which is new scope.

## What's left to harden

1. Get main CI green again, so the three Playwright smokes run.
2. Land `/verify-pitbull` (#584) and make its scripts run on Linux CI as well as Windows. Today they assume `C:\pitbull-private` and PowerShell.
3. Grow the CI role smoke from L4 alone to the L1 to L10 lifecycles, or run the full suite nightly. Most Verify rows above move to Keep once their lifecycle runs green.
4. Write verify playbooks for job cost glance, accounting, reports, and PM paper. None exist today.
5. Run integration tests on every PR. They ran on main but were not run for this inventory.
6. Merge the four health views into one admin page.

## Release bar for 5.0.0

5.0.0 ships when all of these hold:

- CI is green on main, including the role, mobile, and owner signup smokes.
- `/verify-pitbull` passes for every Keep row, with evidence saved per feature.
- Every Verify row is either proven and moved to Keep, or cut.
- The shipped product has no stubs: no "coming soon" controls, no stub jobs, no unreachable pages, and no empty projects.
- This file is current: each row's verdict matches main at the release commit.
