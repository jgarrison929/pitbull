# Role Persona Map (E2E)

Source: `docs/archive/roles-2026-02/` + `DemoBootstrapper.DemoUsers` + `PermissionConstants.RoleTemplates`.

| Persona | Email | AppRole | RBAC Role | Lifecycles |
|---------|-------|---------|-----------|------------|
| CEO / Controller | ceo@demo.local | Admin | Admin | 1, 2 |
| Project Manager | pm@demo.local | Supervisor | ProjectManager | 2, 6, 7, 8, 10 |
| Field Engineer (Foreman) | field-eng@demo.local | User | Foreman | 3, 10 |
| Estimator | estimator@demo.local | User | Estimator | 1 |
| AR Clerk | ar-clerk@demo.local | User | Controller | 4 |
| AP Clerk | ap-clerk@demo.local | User | Controller | 5, 9 |
| Payroll Manager | mgr-payroll@demo.local | Manager | PayrollSpecialist | 3 |

Password: `PitbullDemo2026!`

## Workflow prerequisites

| Workflow | Employee link | Project assignment | Permission |
|----------|---------------|-------------------|------------|
| Time approve | pm@demo.local → DEMO-PM | Manager on active projects | TimeTracking.Approve |
| Time submit | field-eng@demo.local → DEMO-FE | Manager on active projects | TimeTracking.Create |
| Vendor invoices | ap-clerk@demo.local | — | AP.View |
| Owner billing | ar-clerk@demo.local | — | Billing.View + AR.* |
| Daily report | field-eng create, pm submit/approve/lock | PM on project | PM.DailyReports |