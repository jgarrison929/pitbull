# Role experience map (v2.12)

How demo and real users land in the product after login. All personas use shell route **`/`**; content differs by **role profile**.

## Workspace map (2.12.0)

| Workspace | Owns | Landing |
|-----------|------|---------|
| **My Work** | Favorites + recents + role quick actions | `/` |
| **Projects** | Jobs, Bids, **Cost Codes**; open job = 5 primary + More | `/projects` |
| **Finance** | WIP, AR/AP billing, then GL | `/accounting/wip` |
| **Operations** | POs, vendor invoices, vendors/customers, contracts/COs | `/procurement/purchase-orders` |
| **People** | Employees, time, payroll, equipment — **not** cost codes | `/employees` |
| **Reports** | Company reports | `/reports/weekly-summary` |
| **Admin** | Company, users, roles, system | `/admin/company` |

### Workspaces by persona (switcher allow-list)

| Profile | Workspaces |
|---------|------------|
| executive | My Work, Projects, Finance, Reports |
| cfo | My Work, Finance, Operations, Reports |
| projectManager | My Work, Projects, People, Reports |
| estimator / field | My Work, Projects |
| payroll / hr | My Work, People |
| Admin | all |

## Profile pipeline

```
AppUser.Title + Identity roles
        │
        ▼
 RoleProfileResolver (API)
        │
        ├── briefing section  GET /api/briefing/morning
        ├── dashboard layout  GET /api/dashboard/preferences (auto)
        ├── JWT role_profile + job_title
        └── welcome tour steps
```

Frontend nav defaults: `getRoleDefaults(roles, roleProfile)` in `workspaces.ts`. Nav schema version re-seeds favorites when IA changes.

## One-click demo roles

| Role | Home layout | Briefing | Primary metrics / deep-links |
|------|-------------|----------|------------------------------|
| **CEO** | executive | Executive | Portfolio, billed YTD, unbilled backlog, AR−AP net, safety YTD, compliance, pipeline, workforce — `GET /api/dashboard/role-summary` |
| **CFO** | controller | Controller | True AR/AP from aging, AR−AP net, owner billing progress, WIP / journal / P&L actions |
| **PM** | pm | PM | Active jobs, RFIs, time approvals, deadlines |
| **Estimator** | estimator | Estimator | Open bids, due this week, pipeline $ |

## Truth rules

1. Prefer real aggregations (aging, G702 billed, bids, compliance docs, safety incidents).  
2. Label labor-vs-contract as a **proxy**, not full job cost.  
3. “Cash” is **AR − AP net from aging**, not bank cash, unless bank balances are wired.  
4. No fake “retention scores” — show headcount / hires / terminations YTD.

## Secondary seeded personas

AP/AR clerks, field engineer, payroll — full seed exists (`DemoBootstrapper`); not all are one-click. Nav defaults keyed by `role_profile` when present.

## Key code

| Concern | Path |
|---------|------|
| Profile resolver | `src/Pitbull.Api/Services/RoleProfileResolver.cs` |
| Briefing | `BriefingService.cs` |
| Role summary API | `RoleDashboardSummaryService.cs` → `GET /api/dashboard/role-summary` |
| Role views | `src/Pitbull.Web/.../components/dashboard/role-views/` |
| Login catalog | `AuthController` demo roles + `login/page.tsx` |

## Jobsite Digital Twin (field + PM)

- **PM / Supervisor:** Project ? Digital Twin for zone tree, overlay modes (RFI/progress/schedule proxies), zone drill for linked RFIs/reports/plans. Seed demo tree if empty.
- **Field:** Optional zone on mobile field report; site walk links to Twin when `NEXT_PUBLIC_FEATURE_DIGITAL_TWIN` is on (default).
- **Truth:** Overlay bands with * or InsufficientData are proxies / missing links � not invent green health or portfolio % complete from the twin.