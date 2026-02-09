# System Admin Module Specification

**Audience:** IT administrators, system owners, tenant admins  
**Access:** Admin role only (role-gated menu)

---

## Core Principle

IT folks want:
1. **Control** — who can do what
2. **Visibility** — what's happening in the system
3. **Configuration** — customize without code changes
4. **Troubleshooting** — when users say "it's broken"

---

## Menu Structure

```
⚙️ System Admin
├── 👥 User Management
├── 🔐 Roles & Permissions
├── 🏢 Company Settings
├── 📋 Audit Logs
├── 🔗 Integrations
├── 📊 System Health
└── ⚡ Feature Flags
```

---

## 1. User Management (`/admin/users`)

**List View:**
| Column | Description |
|--------|-------------|
| Name | Full name |
| Email | Login email |
| Role | Current role badge |
| Status | Active / Inactive / Locked |
| Last Login | Timestamp |
| Actions | Edit, Deactivate, Reset Password |

**Features:**
- [ ] Search/filter by name, email, role, status
- [ ] Bulk actions (deactivate multiple, assign role to multiple)
- [ ] Invite new user (sends email)
- [ ] Reset password (sends reset link)
- [ ] View user's activity history
- [ ] Impersonate user (for troubleshooting) — audit logged

**Add/Edit User Form:**
- Email, First Name, Last Name
- Role dropdown
- Status toggle
- Force password reset on next login

---

## 2. Roles & Permissions (`/admin/roles`)

**Built-in Roles:**
| Role | Description | Editable |
|------|-------------|----------|
| System Admin | Full access to everything | No |
| Admin | Tenant admin, can manage users | No |
| Manager | Can approve, view reports, manage team | Yes |
| User | Standard access | Yes |
| Read Only | View only, no edits | Yes |

**Permissions Grid:**

| Permission | Admin | Manager | User | Read Only |
|------------|-------|---------|------|-----------|
| View Projects | ✅ | ✅ | ✅ | ✅ |
| Create Projects | ✅ | ✅ | ❌ | ❌ |
| Delete Projects | ✅ | ❌ | ❌ | ❌ |
| View Employees | ✅ | ✅ | ✅ | ✅ |
| Manage Employees | ✅ | ✅ | ❌ | ❌ |
| View Financials | ✅ | ✅ | ❌ | ❌ |
| Approve Time | ✅ | ✅ | ❌ | ❌ |
| Run Reports | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ | ❌ |

**Features:**
- [ ] View role details and assigned permissions
- [ ] Create custom roles
- [ ] Clone existing role as template
- [ ] Assign/remove permissions from custom roles
- [ ] See which users have each role

---

## 3. Company Settings (`/admin/company`)

**General:**
- Company name
- Logo upload
- Primary color (brand theming)
- Address, phone, website
- Tax ID / EIN

**Preferences:**
- Default timezone
- Date format (MM/DD/YYYY vs DD/MM/YYYY)
- Currency
- Fiscal year start month
- Work week (Mon-Fri, Mon-Sat, etc.)

**Modules:**
- Enable/disable modules (Projects, Bids, HR, etc.)
- Module-specific settings

**Notifications:**
- Email notification preferences
- Digest frequency (immediate, daily, weekly)

---

## 4. Audit Logs (`/admin/audit`)

**What's Logged:**
- User logins (success/failure)
- Permission changes
- Data modifications (create, update, delete)
- Exports and downloads
- Admin actions
- API access

**List View:**
| Column | Description |
|--------|-------------|
| Timestamp | When it happened |
| User | Who did it |
| Action | What they did |
| Resource | What was affected |
| Details | Before/after values |
| IP Address | Where from |

**Features:**
- [ ] Filter by user, action type, date range, resource
- [ ] Export to CSV
- [ ] Retention settings (how long to keep)
- [ ] Alert rules (notify on suspicious activity)

---

## 5. Integrations (`/admin/integrations`)

**Available Integrations:**
| Integration | Status | Description |
|-------------|--------|-------------|
| Vista/Viewpoint | 🔜 Coming | ERP sync |
| QuickBooks | 🔜 Coming | Accounting sync |
| Procore | 🔜 Coming | Project import |
| E-Verify | 🔜 Coming | I-9 verification |
| Email (SMTP) | ✅ Ready | Outbound email |
| SSO (SAML/OIDC) | 🔜 Coming | Single sign-on |

**Per Integration:**
- Enable/disable toggle
- Configuration fields (API keys, URLs)
- Connection test button
- Sync status and last sync time
- Error logs

---

## 6. System Health (`/admin/health`)

**Dashboard Cards:**
- API response time (avg, p95)
- Database connections
- Active users (now, today, this week)
- Error rate
- Storage usage

**Service Status:**
| Service | Status |
|---------|--------|
| API | 🟢 Healthy |
| Database | 🟢 Healthy |
| Background Jobs | 🟢 Healthy |
| Email | 🟢 Healthy |

**Features:**
- [ ] View recent errors with stack traces
- [ ] Download diagnostic bundle
- [ ] Trigger manual health check
- [ ] View scheduled job status

---

## 7. Feature Flags (`/admin/features`)

**Purpose:** Enable/disable features without deployment

| Flag | Status | Description |
|------|--------|-------------|
| `ai_summaries` | ✅ On | AI-powered project summaries |
| `new_dashboard` | 🔄 Beta | New dashboard design |
| `hr_module` | ✅ On | HR Core module |
| `payroll_preview` | ❌ Off | Payroll module preview |

**Features:**
- [ ] Toggle flags on/off
- [ ] Per-user or per-role flag overrides
- [ ] Flag descriptions and rollout %

---

## Implementation Priority

### Phase 1: Essential (Week 1)
1. User Management - list, edit, role assignment
2. Audit Logs - view recent activity
3. Company Settings - basic info

### Phase 2: Control (Week 2)
4. Roles & Permissions - view and edit grid
5. System Health - basic dashboard

### Phase 3: Advanced (Week 3+)
6. Integrations - framework + email config
7. Feature Flags

---

## Security Considerations

- All admin routes require `Admin` role
- Audit log every admin action
- Rate limit admin endpoints
- Require re-authentication for sensitive actions (password reset, role changes)
- IP allowlisting option for admin panel

---

## API Endpoints Needed

```
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/{id}
DELETE /api/admin/users/{id}
POST   /api/admin/users/{id}/reset-password
POST   /api/admin/users/{id}/impersonate

GET    /api/admin/roles
POST   /api/admin/roles
PUT    /api/admin/roles/{id}
GET    /api/admin/permissions

GET    /api/admin/audit-logs
GET    /api/admin/audit-logs/export

GET    /api/admin/company
PUT    /api/admin/company

GET    /api/admin/health
GET    /api/admin/health/diagnostics

GET    /api/admin/feature-flags
PUT    /api/admin/feature-flags/{key}
```

---

*This spec covers what IT administrators expect from enterprise software. Start with Phase 1 to give them basic control, then expand.*
