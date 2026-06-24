# Multi-Tenant Provisioning Architecture

**Author:** River (Architecture Agent)  
**Date:** February 17, 2026  
**Status:** PROPOSED — awaiting Josh's review  
**Audience:** Josh (founder), future engineering hires, implementation agents

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Domain Strategy](#2-domain-strategy)
3. [Environment Architecture](#3-environment-architecture)
4. [Tenant Provisioning Pipeline](#4-tenant-provisioning-pipeline)
5. [Customer Onboarding Flow](#5-customer-onboarding-flow)
6. [Default Account Strategy](#6-default-account-strategy)
7. [Transactional Email](#7-transactional-email)
8. [Pricing Model](#8-pricing-model)
9. [Implementation Phases](#9-implementation-phases)
10. [Cost Projections](#10-cost-projections)
11. [Open Questions](#11-open-questions)

---

## 1. Executive Summary

Pitbull Construction Solutions currently runs as a single Railway deployment with multi-tenancy via PostgreSQL Row-Level Security. Every customer shares the same database, the same API process, and the same URL. That works for development and demo, but it's not how you sell construction software.

**The goal:** When Harris Construction signs up on our marketing site, they get `harris.example.com` within 60 seconds. They land in a setup wizard, configure their company, invite their team, and start working. No manual provisioning. No emails to Josh asking "can you set up my account?"

This spec covers the full path from "single demo environment" to "real SaaS with self-service provisioning." It's opinionated — it recommends one path, not five options. Where there are real trade-offs, both sides are laid out with a clear recommendation.

**Inspiration:** Viewpoint/Trimble's model where each customer gets an environment code (like `Z7YR`) mapping to `Z7YR.viewpointforcloud.com`. We'll do the same, but with human-readable slugs as the primary identifier and a short code as the internal reference.

---

## 2. Domain Strategy

### The Problem

`pcscloud.com` is taken. We need a domain that:
- Communicates "Pitbull" and "cloud/SaaS"
- Supports wildcard subdomains (`*.domain`)
- Looks professional on invoices and in email headers
- Is available right now

### Domain Recommendations

| Domain | Vibe | Estimated Cost | Notes |
|--------|------|---------------|-------|
| **`example.com`** | Professional, clear | ~$14/yr | `.app` is Google-backed, HTTPS-only by default, modern SaaS feel |
| `pitbullcloud.com` | Direct, slightly generic | ~$12/yr | If available — strong runner-up |
| `getpitbull.com` | Marketing-friendly | ~$12/yr | Better for marketing site than app URLs |
| `pitbull.build` | Clever, short | ~$35/yr | `.build` is niche but construction-appropriate |
| `usepitbull.com` | Developer-y | ~$12/yr | Common SaaS pattern (usebrex.com, etc.) |

**Recommendation: `example.com`**

Rationale:
- `.app` domains enforce HTTPS at the registry level — no mixed content issues
- "Pitbull Construction" is the full brand name; no ambiguity
- Customers see `harris.example.com` and immediately know what it is
- Available namespace — `.app` is less picked-over than `.com`
- Google Domains (now Squarespace) and Cloudflare both support `.app` registration

**Backup: `pitbullcloud.com`** if Josh prefers `.com` for credibility with construction customers who might not trust newer TLDs.

> **Action item:** Josh to check availability and register via Cloudflare Registrar (cheapest, plus integrated DNS/SSL).

### URL Structure

```
Marketing site:     example.com (or www.)
Customer app:       {slug}.example.com
API:                api.example.com
Admin console:      admin.example.com (internal)
Docs:               docs.example.com
```

**Examples:**
- Harris Construction → `harris.example.com`
- Garrison Enterprises → `garrison.example.com`  
- Demo/sandbox → `demo.example.com`

### Slug Rules

Slugs are the human-readable subdomain identifiers. Separate from the internal 4-character environment code.

- 3–30 characters, lowercase alphanumeric + hyphens
- No leading/trailing hyphens, no consecutive hyphens
- Reserved slugs: `www`, `api`, `admin`, `docs`, `app`, `demo`, `staging`, `mail`, `smtp`, `support`, `status`, `billing`
- Unique globally (enforced at database level)
- Customer chooses during signup, can request change later (admin operation)

**Internal environment code** (like Viewpoint's `Z7YR`):
- Auto-generated 4-character alphanumeric code (uppercase, no ambiguous chars like O/0/I/1)
- Used internally for: log correlation, support tickets, database references
- Not exposed to customers in URLs — slug is the public face
- Stored on the `Tenant` entity as `EnvironmentCode`

```csharp
// Tenant entity addition
public string EnvironmentCode { get; set; }  // "Z7YR"
public string Slug { get; set; }              // "harris" → harris.example.com
```

### DNS & SSL Setup

**Cloudflare (recommended):**

1. Register domain via Cloudflare Registrar
2. Enable Cloudflare proxy (orange cloud) for DDoS protection
3. Create wildcard DNS record: `*.example.com` → Railway load balancer IP/CNAME
4. Cloudflare automatically provisions wildcard SSL via their Universal SSL
5. Enable "Full (Strict)" SSL mode between Cloudflare and Railway

```
DNS Records:
  @                    A/CNAME → marketing site (Vercel/Railway)
  *.example.com  CNAME → pitbull-web.up.railway.app
  api                  CNAME → pitbull-api.up.railway.app  
  mail                 MX → email provider records
  _dmarc               TXT → DMARC policy
```

**Cost: ~$0/yr** for Cloudflare DNS + SSL (free tier). Domain registration ~$14/yr.

**Alternative (Let's Encrypt):** Wildcard certs via DNS-01 challenge. Works but requires automation (certbot + Cloudflare API plugin). Cloudflare's built-in SSL is simpler and free.

---

## 3. Environment Architecture

### Current State

```
Railway Project: "Pitbull"
├── pitbull-api (single .NET service)
├── pitbull-web (single Next.js frontend)
└── postgres (single database)
    └── All tenants share via RLS (app.current_tenant session var)
```

The `TenantMiddleware` resolves tenant from JWT claims, `X-Tenant-Id` header, or subdomain (subdomain path is stubbed but not wired). RLS policies filter all queries by `TenantId`.

### Option A: Shared Infrastructure (Recommended for Phase 1–3)

**One deployment, shared database, tenant isolation via RLS + subdomain routing.**

```
Cloudflare (wildcard DNS + SSL)
    │
    ▼
Railway (single environment)
├── pitbull-api (.NET 9)
│   ├── TenantMiddleware: resolves tenant from subdomain
│   ├── RLS: PostgreSQL enforces tenant isolation
│   └── Per-tenant connection string: OPTIONAL (for future isolation)
├── pitbull-web (Next.js)
│   └── Reads subdomain, passes tenant context to API
└── postgres (shared)
    ├── tenants table (slug, environment_code, plan, status)
    ├── All data tables have TenantId column
    └── RLS policies on every table
```

**What changes from today:**
1. `TenantMiddleware` completes subdomain resolution (currently stubbed)
2. `Tenant` entity gets `Slug`, `EnvironmentCode`, `CustomDomain` fields
3. Frontend reads subdomain on load, stores tenant context
4. Login page is tenant-scoped (shows tenant logo/name)
5. API validates that authenticated user belongs to the subdomain's tenant

**Pros:**
- Almost free to operate — no per-customer infrastructure costs
- Already 80% built (RLS, tenant model, middleware)
- Single deployment = single place to fix bugs and ship features
- Railway Hobby plan ($5/mo) or Pro plan ($20/mo) covers it for early customers
- Simple monitoring — one set of logs, one database to back up

**Cons:**
- Noisy neighbor risk (one customer's heavy query affects others)
- Shared database limits (Railway Postgres maxes at ~50 connections on Hobby)
- Harder to offer SOC 2 / data residency promises
- If the database goes down, ALL customers are down
- Can't easily give enterprise customers their own upgrade schedule

### Option B: Isolated Environments (Future — Phase 4+)

**Separate Railway environment + database per customer.**

```
Railway Project: "Pitbull"
├── Environment: "harris" (Harris Construction)
│   ├── pitbull-api (dedicated)
│   ├── pitbull-web (dedicated)
│   └── postgres (dedicated)
├── Environment: "garrison" (Garrison Enterprises)
│   ├── pitbull-api (dedicated)
│   ├── pitbull-web (dedicated)
│   └── postgres (dedicated)
└── Environment: "platform" (shared services)
    ├── provisioning-api
    ├── billing-service
    └── control-plane-db
```

**Pros:**
- True blast-radius isolation — one customer's DB crash doesn't affect others
- Per-customer scaling (heavy customer gets bigger instance)
- Easy compliance story ("your data lives in its own database")
- Can offer per-customer SLAs, maintenance windows, version pinning
- Railway environments are free to create; you pay per-resource

**Cons:**
- Cost: ~$10–20/mo per customer minimum (dedicated Postgres + compute)
- Ops complexity: deployments hit N environments, not one
- Need a control plane to manage provisioning, health checks, upgrades
- Railway API automation required (or Terraform/Pulumi)
- Monitoring across N environments is harder

**Cost comparison at scale:**

| Customers | Option A (Shared) | Option B (Isolated) |
|-----------|-------------------|---------------------|
| 5 | ~$20/mo | ~$75–100/mo |
| 20 | ~$50/mo | ~$300–400/mo |
| 100 | ~$150–200/mo | ~$1,500–2,000/mo |
| 500 | ~$500/mo (need bigger DB) | ~$7,500–10,000/mo |

### Recommendation: Start Shared, Graduate to Isolated

**Phase 1–3: Option A (Shared).** This is the right call for a product that has 0–50 customers. The RLS architecture already works. The subdomain routing is half-built. The marginal cost of adding a customer is essentially $0.

**Phase 4 (when you need it): Hybrid.** Keep small customers on shared infrastructure. Offer isolated environments as an Enterprise upsell. The `Tenant.ConnectionString` field already exists in the model — it's nullable today, but when populated, the system can route that tenant to a dedicated database.

**The trigger for Phase 4:** When one of these happens:
- A customer requires SOC 2 Type II compliance with dedicated infrastructure
- A customer's usage is measurably impacting other tenants (noisy neighbor)
- You have >50 active tenants and the shared DB is hitting connection limits
- An enterprise customer will pay $2,000+/mo and demands isolation

**Do NOT pre-build isolation infrastructure.** It's wasted effort until you have customers who need it and are willing to pay for it.

### Subdomain Routing Implementation

The `TenantMiddleware` already has the subdomain resolution stubbed. Here's the completed version:

```csharp
// In TenantMiddleware.ResolveTenantId()
// Step 3: Try subdomain
var host = context.Request.Host.Host;
var parts = host.Split('.');

if (parts.Length >= 3)
{
    var slug = parts[0].ToLowerInvariant();
    
    // Skip reserved subdomains
    if (IsReservedSubdomain(slug))
        return null;
    
    // Look up tenant by slug (cached — tenant slugs rarely change)
    var tenant = await tenantCache.GetBySlugAsync(slug);
    if (tenant is not null && tenant.Status == TenantStatus.Active)
        return tenant.Id;
    
    // Unknown subdomain → 404 or redirect to marketing site
    context.Response.StatusCode = 404;
    return null;
}
```

**Tenant cache:** Use `IMemoryCache` with 5-minute TTL. Tenant slugs change approximately never. Don't hit the database on every request.

**Frontend routing:** The Next.js frontend reads `window.location.hostname`, extracts the subdomain, and:
1. Calls `GET /api/tenants/current` (resolved via subdomain on the backend)
2. Receives tenant display name, logo, theme colors
3. Renders tenant-branded login page
4. Stores tenant context for all subsequent API calls

---

## 4. Tenant Provisioning Pipeline

When a new customer signs up, this is the sequence:

```
┌─────────────────────────────────────────────────────────┐
│                   Signup Form Submit                     │
│  (company name, contact email, slug, contractor type)   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              1. Validate & Reserve                       │
│  - Slug uniqueness check                                │
│  - Email format + disposable email block                │
│  - Rate limit (max 3 signups per IP per hour)           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              2. Create Tenant Record                     │
│  - Generate EnvironmentCode (e.g., "H7KX")             │
│  - Create Tenant row (slug, name, plan=Trial, status)   │
│  - Create default Company within tenant                  │
│  - Seed roles (Admin, Manager, Supervisor, User, Viewer)│
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              3. Create Default Accounts                  │
│  - recovery@{slug} (break-glass, disabled by default)   │
│  - support@example.com (our support access) │
│  - system (API/automation service account)               │
│  - Admin user (primary contact's email)                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              4. Send Welcome Email                       │
│  - "Your Pitbull environment is ready"                  │
│  - Link: https://{slug}.example.com/setup   │
│  - Includes: password set link (if new user)            │
│  - From: welcome@example.com                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              5. Customer Lands in Setup Wizard           │
│  (PR #153 — already built)                              │
│  - Company profile completion                           │
│  - Module selection                                     │
│  - Team member invites                                  │
│  - Optional: sample data import                         │
└─────────────────────────────────────────────────────────┘
```

**Total time from form submit to working environment: <30 seconds.**

Everything happens in a single database transaction (steps 2–3), with the email sent asynchronously after commit. No DNS changes needed because the wildcard record already routes all subdomains to our app.

### Environment Code Generation

```csharp
public static class EnvironmentCodeGenerator
{
    // Exclude ambiguous characters: 0/O, 1/I/L
    private const string Chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    
    public static string Generate()
    {
        var random = RandomNumberGenerator.Create();
        var bytes = new byte[4];
        random.GetBytes(bytes);
        
        return new string(bytes.Select(b => Chars[b % Chars.Length]).ToArray());
    }
}
```

4 characters from a 30-char alphabet = 810,000 possible codes. Enough for a very long time. Collision check on insert.

### Provisioning API

```
POST /api/admin/tenants/provision
Authorization: API key or signup flow token

{
  "companyName": "Harris Construction LLC",
  "slug": "harris",
  "primaryContact": {
    "firstName": "Mike",
    "lastName": "Harris", 
    "email": "mike@example.com",
    "phone": "555-0123"
  },
  "contractorType": "GeneralContractor",  // GC, Sub, Specialty, Owner, Utility
  "modules": ["TimeTracking", "ProjectManagement", "Estimating"],
  "plan": "Trial"
}

Response 201:
{
  "tenantId": "a1b2c3d4-...",
  "environmentCode": "H7KX",
  "slug": "harris",
  "url": "https://harris.example.com",
  "adminEmail": "mike@example.com",
  "status": "active"
}
```

---

## 5. Customer Onboarding Flow

### Marketing Site Signup Form

The public marketing site (`example.com` or a separate marketing domain) has a signup CTA that collects:

**Page 1 — About Your Company:**
- Company legal name (required)
- Preferred URL slug (required, auto-suggested from company name, validated in real-time)
- Contractor type: General Contractor / Subcontractor / Specialty / Owner-Builder / Utility (required)
- Number of employees: 1–10 / 11–50 / 51–200 / 200+ (helps size the plan)

**Page 2 — Your Info:**
- First name, last name (required)
- Email address (required — becomes admin account)
- Phone number (optional)
- How did you hear about us? (optional — marketing attribution)

**Page 3 — Modules (optional, can configure later):**
- Time Tracking ✓ (default on)
- Project Management ✓ (default on)
- Estimating / Bidding
- Contracts & Pay Apps
- Equipment Management
- Compliance / Safety

**No credit card required for trial.** 14-day free trial on the Standard plan. This is critical for construction — these buyers want to kick the tires before committing.

### Post-Signup Experience

1. **Provisioning** (< 30 seconds, automatic)
2. **Email verification** (link in welcome email)
3. **First login → Setup Wizard** (PR #153 already built):
   - Company address, logo upload, fiscal year
   - Pay period configuration
   - Import employees (CSV or manual)
   - Invite team members (name + email + role)
4. **Dashboard with onboarding checklist:**
   - ☐ Complete company profile
   - ☐ Add your first project
   - ☐ Enter a time entry
   - ☐ Invite a team member
   - ☐ Configure pay periods
5. **Contextual help tooltips** on first visit to each module
6. **Optional: Load sample data** (a fake project with cost codes, employees, time entries) so the customer can see what a populated system looks like

### Trial-to-Paid Conversion

- Day 1: Welcome email + getting started guide
- Day 3: "How's it going?" check-in (automated email, optional Calendly link for demo)
- Day 7: Feature highlight email based on modules they selected
- Day 10: Trial ending reminder + pricing page link
- Day 13: "Last day" email with one-click upgrade CTA
- Day 14: Trial expires → read-only mode (data preserved 30 days, then archived)

---

## 6. Default Account Strategy

Every new tenant gets four system accounts. This mirrors how enterprise construction ERPs work — there are always service accounts for support, recovery, and automation.

### Account Definitions

| Account | Username | Role | Purpose | Login Enabled |
|---------|----------|------|---------|---------------|
| **Recovery** | `recovery@{tenant}` | SuperAdmin | Break-glass emergency access. Used if admin locks themselves out. | No (enabled only by Pitbull support on request) |
| **Support** | `support@example.com` | Support | Pitbull support team access. Can view data, reset passwords, run diagnostics. Limited write access. | Yes (Pitbull staff only, with audit trail) |
| **System** | `system@{tenant}` | System | API integrations, automated jobs, webhook handlers. Non-interactive. | No (API key auth only) |
| **Admin** | Customer's email | Admin | Primary contact's account. Full tenant admin privileges. | Yes |

### Implementation

```csharp
public class DefaultAccountSeeder
{
    public async Task SeedDefaultAccounts(Guid tenantId, string slug, ContactInfo primaryContact)
    {
        var accounts = new[]
        {
            new { Email = $"recovery+{slug}@example.com", Role = "Recovery", 
                  FirstName = "Recovery", LastName = "Account", LoginEnabled = false },
            new { Email = "support@example.com", Role = "Support",
                  FirstName = "Pitbull", LastName = "Support", LoginEnabled = true },
            new { Email = $"system+{slug}@example.com", Role = "System",
                  FirstName = "System", LastName = "Automation", LoginEnabled = false },
            new { Email = primaryContact.Email, Role = "Admin",
                  FirstName = primaryContact.FirstName, LastName = primaryContact.LastName, 
                  LoginEnabled = true },
        };
        
        foreach (var account in accounts)
        {
            await CreateUserWithRole(tenantId, account);
        }
    }
}
```

**Recovery account pattern:** The `recovery+{slug}@` email uses Gmail/email plus-addressing, so all recovery emails route to a single monitored inbox. The account is disabled by default. To use it:
1. Customer calls/emails Pitbull support
2. Support verifies identity (security questions or domain-verified email)
3. Support enables recovery account temporarily
4. Recovery account password is set and shared securely (one-time link)
5. Customer regains access, recovery account is re-disabled
6. Full audit trail recorded

### New Roles to Add

The current `RoleSeeder` has: Admin, Manager, Supervisor, Viewer, User.

Add:
- **Recovery** — SuperAdmin equivalent, bypasses all RLS (dangerous, disabled by default)
- **Support** — Read-all + password reset + diagnostic endpoints. No financial write access.
- **System** — API-key-authenticated service account. Can do anything the API allows but has no interactive session.

---

## 7. Transactional Email

### Current State

PR #168 has SMTP integration ready but is ON HOLD. The email service currently uses a console stub that logs emails to stdout. We need a real provider.

### Provider Comparison

| | **Postmark** | **SendGrid** | **AWS SES** |
|---|---|---|---|
| **Pricing** | $15/mo for 10K emails | Free for 100/day; $19.95/mo for 50K | $0.10 per 1,000 emails |
| **Free tier** | 100 emails/mo (test) | 100/day forever | 62K/mo if sent from EC2 |
| **Deliverability** | Best-in-class. 99%+ inbox rate. Dedicated IP by default. | Good but variable. Shared IP pool on lower tiers. | Good if you manage reputation. No hand-holding. |
| **Setup complexity** | Low. Dashboard + API key + domain verification. 30 min. | Low-Medium. More config options = more decisions. | Medium-High. Need AWS account, IAM policies, SES verification, bounce handling. |
| **Transactional focus** | Transactional ONLY. They reject marketing email. This is a feature. | Mixed marketing + transactional. Reputation shared. | Anything goes. Your reputation is your problem. |
| **Templates** | Built-in template editor with layouts. Good. | Template engine with design editor. Good. | Raw SES has no templates. Need to build or use SES v2 templates. |
| **Webhook/tracking** | Opens, clicks, bounces, spam complaints. Clean API. | Same. More complex webhook config. | CloudWatch + SNS. AWS-style verbose. |
| **API quality** | Excellent. Clean, simple, well-documented. | Good but sprawling. Many endpoints. | AWS SDK. Verbose but reliable. |
| **Construction SaaS fit** | ★★★★★ | ★★★☆☆ | ★★★☆☆ |

### Recommendation: Postmark

**Postmark is the clear winner for Pitbull.** Here's why:

1. **Deliverability is existential for construction software.** When a superintendent gets a "You have a new timecard to approve" email, it MUST arrive. Postmark's transactional-only policy means their IP reputation is pristine. SendGrid's shared IPs serve marketing newsletters that can tank reputation.

2. **Construction customers use Outlook.** A lot of GCs and subs run Microsoft 365. Postmark has specific optimizations for Outlook/Exchange delivery. This matters.

3. **Simple pricing, no surprises.** $15/mo for 10,000 emails. Pitbull with 50 active tenants averaging 200 emails/month = 10,000 emails. Perfect fit.

4. **The API is clean.** Our .NET backend can integrate in an afternoon:

```csharp
// Postmark integration
var client = new PostmarkClient("server-api-key");

await client.SendEmailWithTemplateAsync(new TemplatedPostmarkMessage
{
    From = "noreply@example.com",
    To = "mike@example.com",
    TemplateAlias = "welcome",
    TemplateModel = new Dictionary<string, object>
    {
        { "company_name", "Harris Construction" },
        { "setup_url", "https://harris.example.com/setup" },
        { "admin_name", "Mike Harris" }
    }
});
```

5. **Message Streams.** Postmark lets you create separate streams (transactional vs. broadcast) under one account. When we eventually add digest notifications ("Your weekly project summary"), it goes in the broadcast stream without affecting transactional deliverability.

**Projected cost:**
- Launch (0–10 tenants): $15/mo (10K emails)
- Growth (10–50 tenants): $15/mo (still under 10K likely)
- Scale (50–200 tenants): $50/mo (50K tier)
- At 500 tenants: ~$85/mo (125K tier)

### Email Types

| Email | Template | Trigger | Priority |
|-------|----------|---------|----------|
| **Welcome** | `welcome` | Signup complete | Phase 1 |
| **Email Verification** | `verify-email` | Signup (before full access) | Phase 1 |
| **Password Reset** | `password-reset` | User requests reset | Phase 1 |
| **Team Invitation** | `invite` | Admin invites team member | Phase 1 |
| **Timecard Approval** | `timecard-approval` | Timecard submitted for approval | Phase 2 |
| **Timecard Rejected** | `timecard-rejected` | Approver rejects timecard | Phase 2 |
| **Pay Period Reminder** | `payperiod-reminder` | 24h before pay period close | Phase 2 |
| **Weekly Digest** | `weekly-digest` | Monday 7am (broadcast stream) | Phase 3 |
| **Trial Expiring** | `trial-expiring` | Day 10, 13, 14 of trial | Phase 2 |
| **Invoice** | `invoice` | Billing cycle (if we do billing) | Phase 3 |

### Email Domain Configuration

```
From address:     noreply@example.com
Reply-to:         support@example.com

DNS Records (Postmark verification):
  TXT  pm-bounces.example.com → [Postmark DKIM record]
  TXT  _dmarc.example.com → "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
  CNAME pm._domainkey.example.com → [Postmark DKIM CNAME]
  MX   example.com → [Postmark inbound, if needed]
  TXT  example.com → "v=spf1 include:spf.mtasv.net ~all"
```

**All email flows through one verified domain.** No per-tenant sending domains — that's unnecessary complexity. Customers receive email `From: "Pitbull Construction" <noreply@example.com>` regardless of their subdomain. The email body references their specific environment URL.

---

## 8. Pricing Model

### Industry Benchmarks

| Product | Model | Approximate Pricing |
|---------|-------|-------------------|
| **Procore** | Unlimited users, per-project-volume | $375–$10,000+/mo based on construction volume |
| **Viewpoint Vista** | Per-user, per-module | $150–300/user/mo, enterprise contracts |
| **Sage 300 CRE** | Per-user, per-module | $200–400/user/mo, perpetual license + maintenance |
| **Buildertrend** | Per-subscription tier | $99–$499/mo (unlimited users on higher tiers) |
| **Jobber** | Per-user tiers | $39–$249/mo for 1–15+ users |

### Key Insight

Construction companies hate per-user pricing for field workers. A GC with 200 field employees doesn't want to pay $50/user/mo = $10,000/mo. But they'll pay $500/mo for the office staff who actually use the full system, with field workers getting limited mobile access.

### Recommended Pricing Tiers

| | **Starter** | **Growth** | **Enterprise** |
|---|---|---|---|
| **Price** | $49/mo | $149/mo | $499/mo |
| **Office users** | Up to 3 | Up to 15 | Unlimited |
| **Field users** | Up to 10 | Up to 50 | Unlimited |
| **Companies** | 1 | Up to 3 | Unlimited |
| **Projects** | Up to 5 active | Up to 25 active | Unlimited |
| **Modules** | Time Tracking + 1 | All modules | All modules + API |
| **Storage** | 5 GB | 25 GB | 100 GB |
| **Support** | Email | Email + chat | Dedicated + phone |
| **Data isolation** | Shared | Shared | Dedicated (optional) |

**"Office user" vs "Field user" distinction:**
- Office users: Full web app access, all features, dashboard, reports, admin
- Field users: Mobile app + timecard entry + daily logs only. Limited web access.
- This mirrors how construction actually works. Supers and foremen enter time. PMs and accountants use the full system.

**Annual discount:** 20% off annual billing (2 months free). `$49/mo → $470/yr`, `$149/mo → $1,430/yr`, `$499/mo → $4,790/yr`.

**Trial:** 14 days free on Growth plan (so they see the good stuff). No credit card required.

### Revenue Projections

| Scenario | Customers | Mix | MRR | ARR |
|----------|-----------|-----|-----|-----|
| **6 months post-launch** | 15 | 10 Starter, 4 Growth, 1 Enterprise | $1,585 | $19,020 |
| **12 months** | 50 | 25 Starter, 18 Growth, 7 Enterprise | $7,420 | $89,040 |
| **24 months** | 150 | 60 Starter, 65 Growth, 25 Enterprise | $24,240 | $290,880 |

These are rough targets, not forecasts. The point: even modest adoption makes the infrastructure costs (section 10) a rounding error.

---

## 9. Implementation Phases

### Phase 1: Transactional Email + Domain (Weeks 1–2)

**Goal:** Real emails go out. We own the domain. PR #168 email service goes live.

- [ ] Register domain (`example.com` or Josh's choice)
- [ ] Set up Cloudflare DNS (A record for marketing site, wildcard for app)
- [ ] Sign up for Postmark, verify domain (SPF, DKIM, DMARC)
- [ ] Complete PR #168: swap console-stub for Postmark integration
- [ ] Build email templates: welcome, verify-email, password-reset, invite
- [ ] Wire up email verification flow from PR #157 onboarding
- [ ] Test end-to-end: signup → verification email → verified account

**Deliverable:** Users get real emails. Domain is live (even if only the root, no subdomains yet).

**Cost:** ~$14 (domain) + $15/mo (Postmark) = $29 first month.

### Phase 2: Subdomain Routing + Tenant Provisioning API (Weeks 3–5)

**Goal:** `{slug}.example.com` works. Tenants can be created programmatically.

- [ ] Add `Slug` and `EnvironmentCode` fields to `Tenant` entity + migration
- [ ] Complete `TenantMiddleware` subdomain resolution (currently stubbed)
- [ ] Add tenant slug cache (`IMemoryCache`, 5-min TTL)
- [ ] Build tenant-branded login page (reads tenant name/logo from subdomain)
- [ ] Build `POST /api/admin/tenants/provision` endpoint
- [ ] Implement `DefaultAccountSeeder` (recovery, support, system, admin accounts)
- [ ] Add `Recovery` and `Support` and `System` roles to `RoleSeeder`
- [ ] Wire Cloudflare wildcard DNS record
- [ ] Test: create tenant via API → navigate to subdomain → login → see dashboard

**Deliverable:** Josh can manually provision a customer by hitting the provisioning API. Customer navigates to their subdomain and logs in.

**Cost:** $0 incremental (same Railway deployment).

### Phase 3: Self-Service Onboarding (Weeks 6–8)

**Goal:** Customer signs up on marketing site, gets their own environment with zero manual intervention.

- [ ] Build public signup form (2–3 page wizard)
- [ ] Real-time slug availability check (`GET /api/tenants/check-slug/{slug}`)
- [ ] Wire signup form → provisioning pipeline (single transaction)
- [ ] Welcome email with setup link
- [ ] First-login redirect to setup wizard (PR #153)
- [ ] Onboarding checklist on dashboard
- [ ] Trial lifecycle emails (day 3, 7, 10, 13 drip)
- [ ] Trial expiration → read-only mode
- [ ] Add rate limiting and anti-abuse (CAPTCHA, disposable email blocking)

**Deliverable:** Fully self-service. Marketing site → working environment in under 60 seconds. No Josh involvement.

**Cost:** Maybe $20 for CAPTCHA service (hCaptcha is free). Everything else is code.

### Phase 4: Billing + Enterprise Isolation (Weeks 9–12+)

**Goal:** Customers can pay. Enterprise customers get isolation if they need it.

- [ ] Integrate Stripe for subscription billing
- [ ] Implement plan limits (user count, project count, storage)
- [ ] Build billing settings page (plan upgrade/downgrade, payment method, invoices)
- [ ] Plan enforcement middleware (403 when over limits)
- [ ] OPTIONAL: Per-tenant database provisioning for Enterprise tier
  - Railway API integration for environment creation
  - Automated database migration runner
  - Health check monitoring per tenant environment
- [ ] Custom domain support (customer brings their own domain, we add CNAME)

**Deliverable:** Revenue flows in. Enterprise customers can get isolated environments.

**Cost:** Stripe fees (~2.9% + 30¢ per transaction). Railway cost per isolated environment (~$10–20/mo).

---

## 10. Cost Projections

### Monthly Operating Costs by Phase

| Item | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|
| Domain registration | $1.17 | — | — | — |
| Cloudflare (DNS + SSL) | $0 | $0 | $0 | $0 |
| Postmark | $15 | $15 | $15 | $15–50 |
| Railway (shared) | $20 | $20 | $20–50 | $50+ |
| Stripe | — | — | — | ~3% of rev |
| Monitoring (Sentry free) | $0 | $0 | $0 | $0–26 |
| **Total** | **~$36** | **~$35** | **~$35–65** | **~$65–130** |

### Break-Even Analysis

At $36/mo operating cost and a blended ARPU of ~$120/mo (weighted average of tier mix):
- **Break-even: 1 customer on Growth plan ($149/mo)**
- By 5 customers: ~$500/mo revenue vs ~$40/mo cost = healthy margin
- By 50 customers: ~$6,000/mo revenue vs ~$100/mo cost = very healthy margin

SaaS infrastructure costs are negligible compared to revenue at almost any scale. The real costs are Josh's time and eventual hiring. This architecture keeps infrastructure cheap while he figures out product-market fit.

---

## 11. Open Questions

These need Josh's input before implementation:

1. **Domain choice:** `example.com` vs `pitbullcloud.com` vs something else? Josh should register it now regardless — domains are cheap and squatters are not.

2. **Trial length:** 14 days recommended, but some construction SaaS does 30 days because construction moves slowly. What feels right?

3. **Free tier?** Some SaaS offers a forever-free tier (1 user, 1 project) to build adoption. Worth considering for sole proprietors / one-person subs.

4. **Marketing site:** Build custom (Next.js on Vercel) or use a hosted page builder (Framer, Webflow)? The signup form needs API integration either way.

5. **Support account access model:** Should Pitbull support have standing access to all tenants, or require customer approval for each access session? Standing access is easier; approval-based is better for trust. Recommendation: Standing read access, approval-required for write access.

6. **Sample data:** Should new tenants get sample data to explore, or start empty? Recommendation: Offer as an option during setup wizard ("Load sample project to explore features?").

7. **Field user mobile app:** The pricing model distinguishes office vs field users. Does Pitbull have or plan a mobile-first field experience? This affects how we count and limit users.

8. **Custom domains:** Enterprise customers may want `app.harrisconstruction.com` pointing to their Pitbull environment. This requires CNAME + SSL verification. Worth building in Phase 4, but should the data model support it from day one? Recommendation: Add a nullable `CustomDomain` field to `Tenant` now, implement the routing later.

---

## Appendix A: Tenant Entity Changes

```csharp
public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    
    // NEW: Human-readable subdomain slug
    public string Slug { get; set; } = string.Empty;
    
    // NEW: Internal 4-char environment code (e.g., "H7KX")
    public string EnvironmentCode { get; set; } = string.Empty;
    
    // EXISTING: Optional dedicated connection string for isolation
    public string? ConnectionString { get; set; }
    
    // NEW: Optional custom domain (e.g., "app.harrisconstruction.com")
    public string? CustomDomain { get; set; }
    
    public TenantStatus Status { get; set; } = TenantStatus.Active;
    public TenantPlan Plan { get; set; } = TenantPlan.Trial; // Changed default
    
    // NEW: Trial tracking
    public DateTime? TrialExpiresAt { get; set; }
    
    public string Settings { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public enum TenantStatus
{
    Active,
    Trial,          // NEW
    TrialExpired,   // NEW
    Suspended,
    Deactivated
}

public enum TenantPlan
{
    Trial,
    Starter,        // Renamed from Standard
    Growth,         // NEW
    Enterprise      // Same
}
```

## Appendix B: Provisioning Sequence Diagram

```
Customer          Marketing Site       API                    Database           Postmark
   │                    │                │                       │                  │
   │── Fill signup ────▶│                │                       │                  │
   │                    │── POST /provision ──▶│                 │                  │
   │                    │                │── Validate slug ─────▶│                  │
   │                    │                │◀── Slug available ───│                  │
   │                    │                │── BEGIN TRANSACTION ─▶│                  │
   │                    │                │── INSERT tenant ─────▶│                  │
   │                    │                │── INSERT company ────▶│                  │
   │                    │                │── INSERT roles ──────▶│                  │
   │                    │                │── INSERT users (x4) ─▶│                  │
   │                    │                │── COMMIT ───────────▶│                  │
   │                    │                │── Send welcome ──────────────────────────▶│
   │                    │◀── 201 Created ─│                       │                  │
   │◀── Redirect to ───│                │                       │                  │
   │   {slug}.app/setup │                │                       │                  │
   │                    │                │                       │                  │
   │── Click email ────────────────────▶│                       │                  │
   │   verify link      │                │── Verify email ──────▶│                  │
   │◀── Setup wizard ──────────────────│                       │                  │
```

## Appendix C: Competitive Reference — How Viewpoint Does It

Viewpoint (Trimble) provisions cloud customers like this:
- Customer signs contract → Viewpoint ops team creates environment
- Environment code generated (e.g., `Z7YR`)
- URL: `Z7YR.viewpointforcloud.com`
- Dedicated database per customer (SQL Server)
- Version pinning: customers can delay upgrades
- Provisioning takes 1–3 business days (manual process)

**What we're doing differently:**
- Self-service (no sales team required for small customers)
- Instant provisioning (< 60 seconds, not 1–3 days)
- Human-readable slugs (`harris.` not `Z7YR.`)
- Shared infrastructure to start (cheaper, faster to market)
- The internal environment code still exists for support/ops use

**What we're borrowing:**
- The environment code concept (for internal reference)
- Default system accounts per tenant
- Module-based configuration per tenant
- The idea that each customer's URL is their identity in the product

---

*This spec will be updated as decisions are made on the open questions. Implementation starts with Phase 1 — transactional email and domain registration.*
