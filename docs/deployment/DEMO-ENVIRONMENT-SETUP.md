# Demo Environment Setup Guide

**Purpose:** Set up a public demo environment for Pitbull UAT testing.
**Domain:** `demo.pitbullconstructionsolutions.com`

## Prerequisites

1. Railway project access (`pretty-communication`)
2. Cloudflare DNS access for `pitbullconstructionsolutions.com`
3. PostgreSQL database provisioned on Railway

## Step 1: Create Demo Service on Railway

```bash
# Connect to Railway project
railway link pretty-communication

# Create demo service
railway service create pitbull-api-demo

# Add PostgreSQL
railway add postgresql --name pitbull-demo-db
```

## Step 2: Configure Environment Variables

Set these variables in Railway for the demo service:

### Required Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `ASPNETCORE_ENVIRONMENT` | `Production` | Use Production mode |
| `RAILWAY_DOCKERFILE_PATH` | `src/Pitbull.Api/Dockerfile` | API Dockerfile location |
| `Demo__Enabled` | `true` | Enable demo bootstrap |
| `Demo__SeedOnStartup` | `true` | Auto-seed on deploy |
| `Demo__DisableRegistration` | `true` | Prevent new signups |
| `Demo__TenantId` | `a1b2c3d4-...` (new GUID) | Fixed tenant ID |
| `Demo__TenantSlug` | `demo` | URL-friendly tenant slug |
| `Demo__TenantName` | `Pitbull Demo` | Display name |
| `Demo__UserEmail` | `demo@pitbullconstructionsolutions.com` | Demo login |
| `Demo__UserPassword` | `[SECURE PASSWORD]` | Demo login password |
| `Demo__UserFirstName` | `Demo` | User display name |
| `Demo__UserLastName` | `User` | User display name |

### Security Variables

| Variable | Value |
|----------|-------|
| `Jwt__Secret` | `[UNIQUE 256-BIT KEY]` |
| `Jwt__Issuer` | `https://demo.pitbullconstructionsolutions.com` |
| `Jwt__Audience` | `https://demo.pitbullconstructionsolutions.com` |

### CORS Variables

```
Cors__AllowedOrigins__0=https://demo.pitbullconstructionsolutions.com
Cors__AllowedOrigins__1=https://pitbull-web-demo.up.railway.app
```

## Step 3: Configure DNS in Cloudflare

1. Login to Cloudflare dashboard
2. Navigate to `pitbullconstructionsolutions.com` → DNS
3. Add CNAME record:

```
Type:  CNAME
Name:  demo
Target: [railway-service-domain].up.railway.app
Proxy: DNS only (gray cloud) initially
TTL:   Auto
```

> **Important:** Keep proxy OFF until Railway SSL is verified.

## Step 4: Configure Railway Domain

```bash
# Add custom domain to demo service
railway domain add demo.pitbullconstructionsolutions.com --service pitbull-api-demo
```

Or in Railway dashboard:
1. Go to demo service → Settings → Domains
2. Add `demo.pitbullconstructionsolutions.com`
3. Wait for SSL certificate provisioning (usually 5-10 minutes)

## Step 5: Deploy and Verify

### Trigger Deployment

```bash
# Deploy from main branch
railway deploy --service pitbull-api-demo
```

Or configure auto-deploy from `main` branch in Railway service settings.

### Verify Demo Bootstrap

Check logs for:
```
Demo bootstrap enabled; ensuring demo tenant + seed data
Created demo tenant [tenant-id] (demo)
Created demo user demo@pitbullconstructionsolutions.com
Demo seed complete: Created 5 projects, 10 bids, ...
```

### Verify Endpoints

```bash
# Health check
curl https://demo.pitbullconstructionsolutions.com/health

# Login test
curl -X POST https://demo.pitbullconstructionsolutions.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@pitbullconstructionsolutions.com","password":"[PASSWORD]"}'
```

## What Gets Seeded

The `DemoBootstrapper` creates:

### Tenant & User
- Demo tenant with fixed ID (for consistent URLs)
- Demo admin user with full access

### Projects (5)
| Project | Type | Status | Value |
|---------|------|--------|-------|
| Riverside Medical Office Building | Commercial | Active | $12.5M |
| Oakwood Estates Phase II | Residential | Pre-Construction | $22.75M |
| Central Valley Distribution Center | Industrial | Active | $48.2M |
| Highway 50 Bridge Rehabilitation | Infrastructure | Completed | $8.9M |
| Lincoln High School Gymnasium | Renovation | On Hold | $3.2M |

### Bids (10)
- Mix of Won, Draft, Submitted, Lost, NoBid
- Each with realistic bid items

### Cost Codes (50+)
- Standard CSI divisions (01-16)
- Equipment codes (EQ-xxx)
- Material codes (MAT-xxx)
- Subcontract codes (SUB-xxx)

### Employees (15)
- Management/salaried (3)
- Supervisors (3)
- Skilled trades/hourly (6)
- Apprentices (2)
- 1 inactive (for realism)

### Time Entries (30 days)
- Realistic daily entries across active projects
- Mix of Draft/Submitted/Approved statuses
- Overtime patterns included

### Subcontracts (8)
- HVAC, Electrical, Plumbing, Fire Protection, etc.
- With change orders (approved, pending)

### Payment Applications
- Progress billing history for active subcontracts

## Troubleshooting

### Demo Seed Fails

Check for:
1. `Demo__Enabled` and `Demo__SeedOnStartup` both `true`
2. Database connection working
3. No existing demo data (seed is idempotent - won't re-create)

To re-seed, you need to delete existing demo data first:
```sql
-- Connect to demo database
DELETE FROM "TimeEntries" WHERE "ProjectId" IN (SELECT "Id" FROM "Projects" WHERE "Number" LIKE 'DEMO-%');
DELETE FROM "ProjectAssignments" WHERE "ProjectId" IN (SELECT "Id" FROM "Projects" WHERE "Number" LIKE 'DEMO-%');
DELETE FROM "Projects" WHERE "Number" LIKE 'DEMO-%';
DELETE FROM "Bids" WHERE "Number" LIKE 'DEMO-%';
DELETE FROM "CostCodes" WHERE "IsCompanyStandard" = true;
DELETE FROM "Employees" WHERE "EmployeeNumber" LIKE 'DEMO-%';
-- Then redeploy to trigger seed
```

### SSL Certificate Issues

1. Ensure Cloudflare proxy is OFF (gray cloud)
2. Wait 10+ minutes for Railway to provision cert
3. Check Railway logs for cert errors
4. If stuck, remove and re-add domain in Railway

### CORS Errors

Ensure `Cors__AllowedOrigins` includes both:
- Custom domain (`demo.pitbullconstructionsolutions.com`)
- Railway domain (`pitbull-web-demo.up.railway.app`)

## Demo User Credentials

| Field | Value |
|-------|-------|
| URL | `https://demo.pitbullconstructionsolutions.com` |
| Email | `demo@pitbullconstructionsolutions.com` |
| Password | (set in Railway env vars) |
| Role | Admin (full access) |

## Security Considerations

1. **Read-heavy demo:** Users can view everything, create entries
2. **No registration:** `DisableRegistration: true` prevents new accounts
3. **Isolated tenant:** Demo tenant is separate from any production data
4. **Retainage reset:** Demo data can be reset without affecting real data

## Next Steps After Setup

1. Verify all module UIs work with demo data
2. Test time entry → approval workflow
3. Test cost rollup reports
4. Test Vista export
5. Document any bugs found

---

**Related Docs:**
- [RAILWAY-DEPLOYMENT.md](./RAILWAY-DEPLOYMENT.md) - Full deployment guide
- Issue #119 - Railway setup issue
- Issue #120 - DNS configuration issue

**Last Updated:** 2026-02-11
