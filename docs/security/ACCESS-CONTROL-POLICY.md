# Access Control Policy
**Pitbull Construction Solutions**
**Effective Date:** February 25, 2026
**Version:** 1.0

## Purpose
Define access control requirements for all users, administrators, and AI agents interacting with Pitbull Construction Solutions.

## Principles
1. **Least Privilege:** Users receive only the permissions necessary for their role.
2. **Separation of Duties:** No single user can approve and execute financial transactions.
3. **Tenant Isolation:** Data is isolated by tenant (TenantId) and company (CompanyId) using PostgreSQL Row-Level Security.
4. **Auditability:** All access is logged. All permission changes are logged.

## Authentication

### User Authentication
- JWT-based authentication with configurable token expiration
- Password requirements: minimum 8 characters, complexity enforced
- Account lockout after 5 failed attempts (15-minute lockout)
- Session tokens stored securely (HttpOnly, Secure, SameSite cookies)

### API Authentication
- Bearer token (JWT) for API access
- Vendor portal: Token-based authentication (time-limited, single-vendor scope)
- AI agents: Service account tokens with scoped permissions

### Future Requirements (SOC 2 prep)
- Multi-factor authentication (MFA) for admin roles
- SSO integration (SAML/OIDC) for enterprise customers
- API key rotation policy (90-day maximum)

## Authorization Model

### Role-Based Access Control (RBAC)
The system implements 45 granular permissions across 8 default roles:

| Role | Description | Example Permissions |
|---|---|---|
| SystemAdmin | Full system access | All permissions |
| CompanyAdmin | Full company access | Manage users, settings, all modules |
| Controller | Financial operations | AP, AR, GL, billing, bank rec, reports |
| ProjectManager | Project operations | Projects, RFIs, submittals, contracts, daily reports |
| FieldSupervisor | Field operations | Time entry, daily reports, punch lists, safety |
| PayrollAdmin | Payroll operations | Employees, time entry approval, payroll export |
| Estimator | Pre-construction | Bids, estimates, vendor pre-qual |
| ReadOnly | View-only access | Read permissions on assigned modules |

### Permission Categories
- **View:** Read access to module data
- **Create:** Create new records
- **Edit:** Modify existing records
- **Delete:** Soft-delete records (no hard deletes in production)
- **Approve:** Approve workflows (pay apps, time entries, change orders)
- **Export:** Export data (PDF, CSV)
- **Admin:** Module-level administration

### Multi-Company Access
- Users may have different roles per company within a tenant
- `UserCompanyAccess` table maps user permissions per company
- Company switching in the UI respects per-company role assignments
- RLS enforces company-level isolation at the database layer

## AI Agent Access

AI agents are first-class users with specific constraints:
- **Identity:** Each AI agent has a dedicated service account with a named identity
- **Permissions:** Agents receive role-based permissions like human users (typically ProjectManager or ReadOnly)
- **Audit:** Every AI action is logged with: agent name, action type, target entity, details, and supervising user
- **Restrictions:** AI agents cannot: create/delete users, modify permissions, access restricted data (SSN, bank accounts), or approve financial transactions above a configurable threshold
- **Kill switch:** Administrators can disable any AI agent instantly

## Privileged Access

### Impersonation
- System administrators may impersonate other users for support/debugging
- Every impersonation session is fully audited (who, whom, when, duration, actions taken)
- Impersonation requires explicit activation (not default)
- Impersonation cannot be used to access Restricted-level data (SSN, bank accounts)

### Database Access
- Direct database access is restricted to deployment infrastructure (Railway)
- No developer has standing database access in production
- Emergency access requires documented justification and is logged

## Account Lifecycle

| Event | Action | Audit |
|---|---|---|
| New user | Admin creates account, assigns role + company access | Logged |
| Role change | Admin modifies permissions | Logged with before/after |
| Deactivation | Admin deactivates account (soft-disable, preserves audit history) | Logged |
| Termination | Account disabled, sessions revoked, access removed | Logged |
| Annual review | All accounts reviewed for appropriate access | Documented |

## Demo Environment

Demo users operate under `DemoRestrictionMiddleware`:
- Cannot modify system settings
- Cannot create new companies
- Cannot access admin functions
- Cannot send external communications (emails, notifications)
- All demo data is reset periodically

## Review Schedule
This policy will be reviewed annually or when significant changes occur in the authorization model.
