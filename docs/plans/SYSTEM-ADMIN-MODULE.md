# System Admin Module - Planning Doc

**Date:** 2026-02-13
**Status:** Planning
**Priority:** High - blocking user testing

---

## Problems to Solve

1. **Role Assignment Gap** - Users created without proper roles can't do anything
2. **No Admin UI** - Can't manage users/roles without database access
3. **Migration Gaps** - Schema changes don't ensure data integrity (e.g., users must have roles)
4. **Tenant Isolation** - Admin vs tenant-level permissions unclear

---

## Core Requirements

### 1. System Admin Portal
- User management (list, create, edit, disable)
- Role assignment UI
- Tenant management (for SaaS multi-tenant)
- Audit logs viewer

### 2. Role Hierarchy
```
SuperAdmin (system-wide)
  └── Admin (tenant-level)
        └── Manager
              └── Supervisor
                    └── User
```

### 3. Default Role on User Creation
- New users should get a default role (User? Configurable per tenant?)
- Migration should backfill existing users without roles

### 4. Data Integrity Migrations
- CHECK constraints where appropriate
- Seed data validation
- Role existence checks on startup

---

## Questions to Resolve

1. Should there be a "SuperAdmin" above tenant Admins?
2. What's the default role for new users?
3. Should roles be customizable per tenant or fixed?
4. How do we handle the demo user bootstrap cleanly?

---

## Tonight's Tasks

- [ ] Sketch out Admin UI wireframes
- [ ] Design role/permission schema if needed
- [ ] Write migration to ensure all users have at least one role
- [ ] Build basic Admin Users page with role assignment

---

## Notes

(Add discussion notes here)
