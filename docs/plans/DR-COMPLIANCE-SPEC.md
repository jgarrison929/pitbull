# Disaster Recovery & Compliance Specification

**Status:** Draft  
**Author:** River Banks Garrison  
**Date:** February 24, 2026  
**Priority:** P2 (required before first paying customer)

---

## Context

Pitbull Construction Solutions is a construction ERP handling financial data, payroll, certified payroll (prevailing wage), contracts, and project documentation. Construction companies are subject to federal, state, and industry-specific retention and compliance requirements. Before onboarding paying customers, we need documented policies for data retention, backup/recovery, disaster recovery, and a path toward SOC 2 readiness.

**Current infrastructure:**
- **Compute:** Railway (Docker containers, auto-deploy from main)
- **Database:** Railway-managed PostgreSQL 17
- **Cache:** Railway Redis (redis-u4l2.railway.internal:6379)
- **Email:** Resend (transactional), Google Workspace (business)
- **Monitoring:** PostHog (analytics, error tracking, session recording)
- **DNS/CDN:** Cloudflare (example.com, pitbullconstructionsolutions.com)
- **Source:** GitHub (jgarrison929/pitbull-private)
- **Domains:** demo.example.com (web), demo-api.example.com (API)

---

## 1. Data Retention Policies

### 1.1 Regulatory Requirements

| Regulation | Retention Period | Applies To |
|---|---|---|
| IRS (26 USC §6501) | **7 years** | Tax records, payroll tax filings, 1099s, W-2s |
| Davis-Bacon Act (29 CFR §5.6) | **3 years** | Certified payroll records (WH-347), wage determinations |
| California Labor Code §1174 | **4 years** | Employment records, time cards, wage statements |
| OSHA (29 CFR §1904.33) | **5 years** (injury/illness logs), **30 years** (exposure records) | Safety logs, incident reports, exposure monitoring |
| Contract Documents | **Life of project + 6-10 years** (statute of limitations) | Contracts, change orders, RFIs, submittals, pay apps |
| Bonding/Surety | **10+ years** | Financial statements, WIP schedules, project histories |
| GDPR (if international) | **Minimum necessary** | PII, employee data, customer data |

### 1.2 Module-to-Retention Mapping

| Pitbull Module | Primary Retention | Governing Rule | Notes |
|---|---|---|---|
| **Billing** (GL, AP, AR, Journal Entries) | 7 years | IRS | Financial core. Never soft-delete within retention window. |
| **Payroll** (Time Entries, Pay Runs) | 7 years (IRS) / 4 years (CA) | IRS + CA Labor | Whichever is longer. Certified payroll = 3 years federal, but keep 7 for tax tie-out. |
| **Contracts** (Contracts, Change Orders) | Life + 10 years | Statute of limitations | Include all amendments, signed documents, billing history. |
| **Project Management** (RFIs, Submittals, Daily Reports) | Life + 10 years | Contract + litigation | RFIs are legal evidence in disputes. Never delete. |
| **Payment Applications** (G702/G703) | 7 years | IRS + bonding | Payment history is bonding company's #1 data request. |
| **Employees** (Records, Onboarding) | 4 years after separation | CA Labor | Keep longer if involved in prevailing wage projects. |
| **Reports** (WIP, AR Aging, Cost Reports) | 7 years | IRS + bonding | Snapshot reports at period close. Regeneratable but keep originals. |
| **Bank Reconciliation** | 7 years | IRS | Audit trail for every matched transaction. |
| **AI Audit Logs** | 7 years | Internal policy | Every AI agent action with supervised-by context. |
| **System Admin** (RBAC, User Activity) | 7 years | SOC 2 prep | Who had access to what, when. |
| **Notifications** | 1 year | Internal policy | Transient. Archive delivery receipts, purge content. |

### 1.3 Implementation Plan

**Phase 1 (Pre-customer):**
- Add `RetentionPolicy` enum to core entities: `Standard7Year`, `ContractLife`, `EmployeeSeparation`, `Transient`
- Soft-delete is already implemented — add `RetentionExpiresAt` computed column
- Admin dashboard: retention compliance report (entities approaching/past retention)
- Block hard-delete API for any entity within retention window

**Phase 2 (Post-first-customer):**
- Automated archival job: move expired records to cold storage (separate schema or S3)
- Legal hold flag: override retention for litigation/audit holds
- Per-tenant retention policy overrides (some GCs require longer than minimums)

---

## 2. Backup & Recovery Strategy

### 2.1 Current State

| Component | Current Backup | Gap |
|---|---|---|
| PostgreSQL | Railway automated daily backups (Pro plan) | No verified restore process, no cross-region copy |
| Redis | None (ephemeral cache) | Acceptable — cache is reconstructable |
| Source Code | GitHub (private repo) | Good. Multiple contributors = implicit backup. |
| Documents/Files | Database (file metadata) + Railway volume | No off-platform backup |
| Secrets | Railway env vars + secrets vault in DB | No offline backup of encryption keys |

### 2.2 Target Recovery Objectives

| Metric | Target (Demo/Pre-Revenue) | Target (Production/Paying) |
|---|---|---|
| **RPO** (Recovery Point Objective) | 24 hours | 1 hour |
| **RTO** (Recovery Time Objective) | 4 hours | 1 hour |
| **Backup Frequency** | Daily (Railway default) | Continuous WAL archiving + daily full |
| **Backup Retention** | 7 days | 30 days + monthly for 1 year |
| **Cross-Region** | Not needed | Required (different Railway region or S3) |

### 2.3 Implementation Plan

**Phase 1 — NOW (demo stage):**
- [ ] Document Railway's backup schedule and verify restore works (test restore to staging)
- [ ] Export DataProtection keys to secure offline location (losing these = losing all encrypted fields)
- [ ] Add `pg_dump` cron job to Railway → S3 bucket (daily, 7-day retention)
- [ ] Document manual restore procedure in runbook

**Phase 2 — Before first paying customer:**
- [ ] Enable PostgreSQL WAL archiving for point-in-time recovery
- [ ] Cross-region backup (Railway US-West → S3 US-East or different provider)
- [ ] Automated restore testing (monthly: restore backup to temp environment, run health checks)
- [ ] Encrypt backups at rest (AES-256, key stored separately from backup)

**Phase 3 — Enterprise tier:**
- [ ] Multi-region active deployment
- [ ] Real-time replication to standby
- [ ] Automated failover with DNS cutover

### 2.4 Redis Recovery

Redis is used for CAP event bus transport and response caching. It is **ephemeral by design**:
- Cache miss = regenerate from PostgreSQL (slower but correct)
- CAP outbox is in PostgreSQL — events will retry on Redis reconnection
- **No backup needed.** Document this decision so future engineers don't panic.

### 2.5 Critical Secrets Inventory

| Secret | Location | Backup Plan |
|---|---|---|
| PostgreSQL connection string | Railway env var | Document in secure vault |
| JWT signing key | Railway env var | **CRITICAL** — rotating this invalidates all sessions |
| DataProtection keys | PostgreSQL (PersistKeysToDbContext) | Included in DB backup. Also export to offline vault. |
| Resend API key | Railway env var | Regeneratable from Resend dashboard |
| PostHog API keys | Railway env var + .env.production | Regeneratable |
| AI provider keys (OpenAI, Anthropic) | Encrypted in DB (secrets vault) | Encrypted with DataProtection — backup DP keys! |
| Cloudflare API token | Local reference | Regeneratable |

---

## 3. Disaster Recovery Procedures

### 3.1 Failure Scenarios

| Scenario | Severity | Detection | Recovery |
|---|---|---|---|
| **Railway container crash** | Low | Health check + PostHog | Automatic restart. If crash-looping: `railway redeploy --yes` |
| **Bad deployment** | Medium | PostHog errors spike | Revert: `git revert` + push to main (auto-deploys) |
| **Database corruption** | High | API 500s, data inconsistency | Restore from backup (see 2.3). Stop all writes first. |
| **Railway region outage** | High | Railway status page | Phase 1: Wait. Phase 2+: Failover to backup region. |
| **Compromised credentials** | Critical | Unusual API patterns | Rotate ALL secrets immediately. See incident response (§5). |
| **Data breach** | Critical | PostHog/audit anomaly | Incident response plan. Customer + regulatory notification. |
| **Accidental data deletion** | Medium | User report or audit log | Soft-delete = recoverable. Hard-delete = restore from backup. |

### 3.2 Deployment Rollback Procedure

```
1. Identify bad commit: check Railway deploy logs + PostHog errors
2. git revert <bad-commit> --no-edit
3. git push origin main
4. Railway auto-deploys the revert
5. Verify: curl https://demo-api.example.com/health
6. If DB migration was involved:
   a. Check if migration is reversible (has Down() method)
   b. If yes: railway run -- dotnet ef database update <previous-migration>
   c. If no: manual SQL to undo schema changes, then remove migration record
7. Post-mortem within 24 hours
```

### 3.3 Communication During Outages

**Pre-customer (current):**
- Josh + River monitor via PostHog and health checks
- No external communication needed

**Post-customer:**
- Status page (recommend: Instatus or Atlassian Statuspage, free tier)
- Email notification to affected tenants within 30 minutes of confirmed outage
- Post-mortem published within 48 hours for any outage > 15 minutes

---

## 4. Compliance Framework

### 4.1 SOC 2 Readiness Checklist

SOC 2 Type II is the gold standard for SaaS selling to enterprises. Not needed now, but every decision should move toward it.

**Trust Service Criteria — Current State:**

| Criteria | Status | Notes |
|---|---|---|
| **Security** | 🟡 Partial | RBAC (45 permissions), JWT auth, field-level encryption, file upload security, rate limiting. Missing: WAF, vulnerability scanning, penetration test. |
| **Availability** | 🟡 Partial | Railway auto-scaling, health checks, PostHog monitoring. Missing: SLA definition, redundancy, documented recovery procedures (this doc). |
| **Processing Integrity** | 🟢 Good | Comprehensive audit trail (designed), input validation, CQRS event sourcing pattern. |
| **Confidentiality** | 🟢 Good | Tenant isolation (RLS), field-level encryption, API key encryption, demo restriction middleware. |
| **Privacy** | 🟡 Partial | Basic privacy policy exists. Missing: data processing agreement template, GDPR-specific controls, data subject access request workflow. |

**Priority actions for SOC 2 path:**
1. ✅ Access control (RBAC — done)
2. ✅ Encryption at rest (field-level — done)
3. ✅ Encryption in transit (TLS — Railway default)
4. ✅ Audit logging (designed, partially implemented)
5. 🔲 This DR & Compliance spec (in progress)
6. 🔲 Vulnerability scanning (GitHub Dependabot active, need SAST)
7. 🔲 Penetration test (external — executive review item X5)
8. 🔲 Formal change management policy (PR workflow is close, needs documentation)
9. 🔲 Employee security training (N/A until we have employees)
10. 🔲 Vendor risk assessment (Railway, Resend, PostHog, Cloudflare)

### 4.2 Encryption Summary

| Layer | Method | Status |
|---|---|---|
| In transit | TLS 1.2+ (Railway managed) | ✅ Done |
| Database at rest | Railway-managed disk encryption | ✅ Done |
| Field-level at rest | ASP.NET DataProtection (AES-256) | ✅ Done |
| Backups at rest | Not yet encrypted | 🔲 Phase 2 |
| Secrets in DB | DataProtection encrypted | ✅ Done |

### 4.3 Access Control Audit

**Current controls:**
- 45 granular permissions across all modules
- Role-based assignment (Admin, Manager, User, Viewer + custom)
- Multi-company access scoping (UserCompanyAccess)
- Demo restriction middleware (blocks admin paths for demo users)
- Tenant isolation via PostgreSQL RLS (set_config per connection)

**Gaps:**
- No MFA (should add before enterprise customers)
- No session management UI (active sessions, force logout)
- No IP allowlisting (future enterprise feature)
- JWT key rotation not automated (manual process — see §5 of Still Open)

---

## 5. Security Incident Response Plan

### 5.1 Detection Sources

| Source | What It Catches | Check Frequency |
|---|---|---|
| PostHog `$exception` events | Runtime errors, unhandled exceptions | Every heartbeat (~30 min) |
| PostHog `api_error` events | 4xx/5xx API responses | Every heartbeat |
| GitHub Dependabot | Known CVEs in dependencies | Continuous (PR alerts) |
| Railway deploy logs | Build/deploy failures | On every deploy |
| Audit trail | Unauthorized access attempts | Daily review (automated) |
| Health endpoint | Service availability | Railway health check (continuous) |

### 5.2 Severity Classification

| Level | Definition | Response Time | Examples |
|---|---|---|---|
| **P0 — Critical** | Data breach, unauthorized access to customer data | Immediate (< 15 min) | SQL injection, auth bypass, data exfiltration |
| **P1 — High** | Service down, data corruption, security vulnerability | < 1 hour | Database corruption, Railway outage, unpatched CVE |
| **P2 — Medium** | Degraded service, non-critical bug affecting users | < 4 hours | Slow queries, partial feature failure, UI errors |
| **P3 — Low** | Cosmetic issues, minor bugs, non-urgent improvements | Next business day | Typos, minor UX issues, non-blocking warnings |

### 5.3 Incident Response Procedure

```
1. DETECT — PostHog alert, user report, or monitoring catch
2. ASSESS — Classify severity (P0-P3), identify scope (which tenants affected?)
3. CONTAIN — Stop the bleeding:
   - P0: Immediately disable affected feature or take service offline
   - P1: Deploy hotfix or rollback
   - P2-P3: Schedule fix in next sprint
4. COMMUNICATE — Notify affected parties:
   - P0: Josh immediately + affected customers within 30 min
   - P1: Josh within 1 hour
   - P2-P3: Daily log update
5. REMEDIATE — Fix root cause, deploy, verify
6. REVIEW — Post-mortem within 48 hours (P0/P1), document in memory/incidents/
```

### 5.4 Regulatory Notification Requirements

| Regulation | Notification Window | Who |
|---|---|---|
| CCPA (California) | 72 hours | Affected California residents |
| State breach laws (varies) | 30-90 days depending on state | Affected individuals + state AG |
| Contractual (customer SLA) | Per contract | Customer security contact |
| GDPR (if applicable) | 72 hours | Supervisory authority + affected individuals |

---

## 6. Implementation Priority

### Now (Before First Customer)
1. ✅ Document retention requirements (this spec)
2. 🔲 Test Railway backup restore procedure
3. 🔲 Export DataProtection keys to offline vault
4. 🔲 Set up supplemental `pg_dump` → S3 daily backup
5. 🔲 JWT key rotation (replace weak passphrase with random 256-bit)
6. 🔲 Write deployment rollback runbook

### Before Enterprise Sales
7. 🔲 Automated monthly backup restore testing
8. 🔲 Cross-region backup
9. 🔲 MFA support
10. 🔲 External penetration test
11. 🔲 SOC 2 Type I audit
12. 🔲 Data processing agreement template

### Future (Enterprise Tier)
13. 🔲 Multi-region deployment
14. 🔲 SOC 2 Type II
15. 🔲 Formal change management policy
16. 🔲 IP allowlisting
17. 🔲 GDPR data subject access request workflow
18. 🔲 Automated compliance reporting dashboard

---

## Consequences

**Positive:**
- Clear retention policies prevent accidental data deletion and legal liability
- Documented recovery procedures reduce panic during incidents
- SOC 2 checklist gives enterprise sales a concrete path
- Incident response plan means we don't improvise during a crisis

**Negative:**
- Backup infrastructure adds ~$20-50/month (S3 storage)
- Compliance overhead increases development complexity
- Some features (legal hold, archival) are non-trivial to implement

**Accepted trade-offs:**
- Demo stage: Railway's built-in backups are sufficient. Supplemental backup is insurance, not urgency.
- No SOC 2 audit until we have revenue to justify $20-50K cost
- GDPR is deferred unless/until we have international customers
