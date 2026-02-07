# Pitbull Construction Solutions - Release Plan

**Created:** 2026-02-01
**Last Updated:** 2026-02-06

---

## Team Reality

- **Solo developer** with AI agent assistance
- **AI agents:** Sub-agents running 24/7 on scheduled pipeline ticks
- **AI agents can:** code, test, document, create PRs, run QA
- **AI agents cannot:** make product decisions, deploy to production, approve PRs for merge
- **Realistic expectation:** AI agents produce ~70% usable output. The other 30% needs human review/fixes.

---

## Version Strategy

### v0.1.0 - Alpha (Current State Stabilization)

**GitHub Milestone:** [v0.1.0 - Alpha](https://github.com/jgarrison929/pitbull/milestone/1)
**Target:** Mid-February 2026
**Status:** In progress

**What exists today:**
- Core module (DbContext, CQRS pipeline, multi-tenancy, base entities)
- Projects module (CRUD, phases)
- Bids module (CRUD, bid items, bid-to-project conversion)
- Auth (JWT, registration with tenant creation, login)
- Frontend (Next.js 15, 10 routes, auth flow, projects/bids CRUD)
- Deployed to Railway (API + Web)
- CI pipeline (GitHub Actions: build + lint)

**What needs to happen for v0.1.0 tag:**
- [ ] Fix known issues from BEST-PRACTICES.md (delete endpoint no-op, PagedResult location, CreatedBy/UpdatedBy)
- [ ] Health check tests DB connectivity (#24 infrastructure)
- [ ] Request logging middleware with correlation IDs
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all existing endpoints (FluentValidation)
- [ ] Pagination on list endpoints
- [ ] CI runs integration tests with PostgreSQL service container (#22)
- [ ] Docker Compose dev environment works (#23)
- [ ] EF migrations pipeline documented (#24)
- [ ] CHANGELOG.md created with current state
- [ ] All existing TypeScript errors resolved

**Quality Gates:**
- `dotnet build --configuration Release` passes with zero warnings
- `npm run build` passes with zero errors
- `npm run lint` passes
- All existing endpoints return correct HTTP status codes
- Registration + login + CRUD flow works end-to-end on Railway
- CI pipeline green on develop

**Assigned Issues:** #1, #2, #3, #4, #5, #6, #7, #8, #11, #12, #22, #23, #24

---

### v0.2.0 - Beta Demo (Show It to a Real GC)

**GitHub Milestone:** [v0.2.0 - Beta Demo](https://github.com/jgarrison929/pitbull/milestone/2)
**Target:** Late March 2026
**Status:** Not started

This is the version you walk into a general contractor's office and demo on a laptop. It needs to look real, feel real, and cover enough of their workflow to start a conversation.

**Features:**
- [ ] Contracts module -- subcontract management (#13)
- [ ] Change order workflow (draft/pending/approved/executed) (#14)
- [ ] Project phases and cost codes (#9)
- [ ] Budget tracking with projections (#10)
- [ ] Frontend polish -- mobile responsive at 375px (#18, #19, #20, #21)
- [ ] Collapsible sidebar / hamburger nav on mobile
- [ ] Dashboard shows real stats (project count, bid count, total contract value)
- [ ] Loading skeletons and empty states on all pages
- [ ] Branching strategy and environments finalized (#26)
- [ ] Seed data script that populates a realistic demo tenant
- [ ] Staging environment on Railway (develop branch auto-deploys)

**Quality Gates:**
- Everything from v0.1.0, plus:
- Full CRUD works for Projects, Bids, Contracts, Change Orders
- Bid-to-project conversion creates project with phases from bid items
- Mobile responsive -- no horizontal scroll at 375px on any page
- Demo seed data loads in under 30 seconds
- Page load under 3 seconds on 4G connection
- Zero console errors in browser
- Staging environment matches production config

**Assigned Issues:** #9, #10, #13, #14, #18, #19, #20, #21, #26

---

### v0.5.0 - Early Access (Pilot Customer Onboarding)

**GitHub Milestone:** [v0.5.0 - Early Access](https://github.com/jgarrison929/pitbull/milestone/3)
**Target:** June 2026
**Status:** Not started

This is the version where a real GC uses it on a real project. Not the whole company, just one project manager testing it alongside their current tools.

**Features:**
- [ ] Documents module -- file upload, versioning, folder structure, search (#15)
- [ ] Subcontractor portal -- external auth, view contracts, upload compliance docs (#16)
- [ ] Billing module -- owner billing, schedule of values, AIA-style pay apps (#17)
- [ ] Daily Log -- date, weather, workforce, equipment, notes (new issue needed)
- [ ] RFI tracking -- create, assign, track, close, link to project (new issue needed)
- [ ] Change order cost impact flows through to budget projections
- [ ] Email notifications (new subcontract, CO pending approval, billing submitted)
- [ ] Self-hosted Docker Compose package (PostgreSQL + API + Web)
- [ ] User roles beyond admin (project manager, estimator, field, read-only)
- [ ] Data export (CSV) for projects, bids, contracts
- [ ] API documentation (Swagger/OpenAPI polished)

**Quality Gates:**
- Everything from v0.2.0, plus:
- Document upload/download works with files up to 50MB
- Portal login works for external users (separate from internal)
- AIA G702/G703 PDF generation works
- Docker Compose `docker compose up` gets a working instance from scratch
- Role-based access enforced (estimator cannot approve change orders, etc.)
- No data leaks between tenants (verified by integration tests)
- Automated backup/restore procedure documented
- 95%+ uptime on Railway over a 7-day test period
- Unit test coverage on all CQRS handlers

---

### v1.0.0 - GA (Production Ready)

**GitHub Milestone:** [v1.0.0 - GA](https://github.com/jgarrison929/pitbull/milestone/4)
**Target:** October 2026
**Status:** Not started

Production ready for paying customers. This is where money changes hands.

**Features:**
- [ ] Submittals module (track from subs, review/approve/reject)
- [ ] Punch list module (mobile capture, photo attach, assign, close)
- [ ] Schedule/Gantt view (read-only timeline linked to project phases)
- [ ] QuickBooks Online integration (export AP/AR)
- [ ] Approval workflows (configurable per tenant -- who can approve what, and up to what amount)
- [ ] Audit log (who changed what, when)
- [ ] Onboarding wizard for new tenants
- [ ] Public pricing page
- [ ] Terms of service and privacy policy
- [ ] Stripe billing integration (subscription management)
- [ ] Performance hardened (database indexes, query optimization, caching)
- [ ] Security audit (OWASP top 10 review, penetration test or self-assessment)
- [ ] Monitoring and alerting (error tracking, uptime monitoring)
- [ ] Disaster recovery plan documented and tested

**Quality Gates:**
- Everything from v0.5.0, plus:
- Load test: 50 concurrent users, p95 response time under 500ms
- Security: no critical or high vulnerabilities in OWASP assessment
- Data: full backup/restore tested and documented
- Legal: ToS and privacy policy reviewed
- Billing: Stripe subscription flow works end-to-end
- Uptime: 99.5% over a 30-day test period
- Documentation: user guide covers all modules
- Self-hosted: installation guide tested by someone else

---

## Go-Live Checklist (v0.2.0 Demo Readiness)

Before showing this to a real general contractor:

### Security
- [ ] All endpoints require authentication (except login/register)
- [ ] Rate limiting on auth endpoints (5 attempts per minute)
- [ ] JWT tokens expire in 24 hours or less
- [ ] No secrets in client-side code or git history
- [ ] HTTPS enforced (Railway handles this)
- [ ] CORS locked to known origins only
- [ ] SQL injection not possible (parameterized queries via EF Core)

### Performance
- [ ] Initial page load under 3 seconds on 4G
- [ ] API responses under 500ms for CRUD operations
- [ ] List endpoints paginated (no unbounded queries)
- [ ] Images/assets optimized and cached

### Documentation
- [ ] README has clear "what is this" and screenshots
- [ ] API endpoints documented (at minimum, a Swagger UI that works)
- [ ] Demo login credentials documented (for the demo tenant)

### Demo Data
- [ ] Seed script creates a realistic GC tenant ("Demo Construction Co.")
- [ ] 5-10 projects in various states (bidding, active, complete)
- [ ] 15-20 bids (won, lost, pending)
- [ ] 3-5 subcontracts with change orders
- [ ] Budget data with realistic dollar amounts (residential and commercial)
- [ ] Named contacts and companies (not "Test User 1")

### Presentation
- [ ] Mobile works (demo on phone during meeting)
- [ ] Dark mode or at least consistent color scheme
- [ ] Logo and branding in place (even if placeholder)
- [ ] No "lorem ipsum" or placeholder text visible
- [ ] Error states handled gracefully (not blank screens)

---

## Sprint Cycles

### How Pipeline Ticks Map to Sprints

The AI pipeline runs every 20 minutes. That is 72 ticks per day, 504 per week.

**Not all ticks produce useful output.** Realistic assumptions:
- ~40% of ticks result in a meaningful commit or PR
- ~20% of ticks are QA, docs, or research (valuable but no code)
- ~20% of ticks hit blockers, conflicts, or produce work that needs rework
- ~20% of ticks are wasted (rate limits, build failures, bad assumptions)

That gives us roughly **28-30 meaningful code PRs per week** from AI agents, plus the lead's nights/weekends contributions.

### Sprint Structure

Use **1-week sprints**, Monday to Sunday.

- **Monday-Friday daytime:** AI agents work autonomously, creating PRs against develop
- **Weeknight evenings:** Lead reviews PRs, merges good ones, closes bad ones, adjusts priorities
- **Weekends:** Lead does hands-on development, architecture decisions, and integration work
- **Sunday night:** Sprint review -- Lead updates pipeline backlog, picks next week's priorities

### Release Cadence

- **Alpha (v0.1.x):** Tag when the quality gates pass. Could be any day.
- **Beta and beyond:** Cut a release every 2 weeks from develop -> staging -> main
- **Hotfixes:** Branch from main, fix, merge back to main AND develop

### Release Process

1. Freeze develop (no new merges for 24 hours)
2. Deploy develop to staging environment
3. Run full QA pass on staging (AI agent + human spot check)
4. If clean, merge develop -> main
5. Tag the release: `git tag -a v0.X.0 -m "Release v0.X.0"`
6. Railway auto-deploys main to production
7. Write release notes (see below)

### Release Notes Format

Keep them short. Nobody reads long changelogs.

```markdown
## v0.2.0 - Beta Demo (2026-03-XX)

### New
- Contracts module with subcontract management
- Change order workflow (draft/pending/approved/executed)
- Project budget tracking with cost code phases
- Mobile responsive design

### Fixed
- Delete endpoint now actually soft-deletes records
- PagedResult moved to Core module

### Known Issues
- Document upload not yet available (coming in v0.5.0)
- Email notifications not yet implemented
```

---

## Risk Register

### R1: Lead Burnout
- **Likelihood:** High
- **Impact:** Project stalls for weeks or months
- **Mitigation:** Keep scope small per version. AI agents handle the grind work. Lead only does architecture, reviews, and decisions. Do not commit to external deadlines.

### R2: AI Agent Quality Drift
- **Likelihood:** Medium
- **Impact:** Bad code accumulates, technical debt compounds
- **Mitigation:** Lead must review every PR before merge. AI agents run CI checks. Weekly code quality review. If agent output quality drops, pause pipeline and fix patterns.

### R3: Railway Costs Spike
- **Likelihood:** Low-Medium
- **Impact:** Monthly costs exceed hobby budget before revenue
- **Mitigation:** Monitor Railway usage dashboard weekly. Set spending alerts. The self-hosted Docker option is a fallback if cloud costs get uncomfortable.

### R4: Security Incident Before GA
- **Likelihood:** Low
- **Impact:** Reputation damage, potential data exposure
- **Mitigation:** No real customer data until v0.5.0 at the earliest. Keep demo data fictional. Run OWASP checks before each release. Multi-tenancy RLS is enforced at database level.

### R5: Competitor Moves Faster
- **Likelihood:** Medium (Procore has hundreds of engineers)
- **Impact:** Low -- Pitbull's wedge is self-hosted + affordable, not feature parity
- **Mitigation:** Stay focused on the differentiators. Do not try to match Procore feature-for-feature. Target the segment Procore ignores: GCs under $50M annual revenue who find Procore too expensive and too complex.

### R6: Git Conflicts Between AI Agents
- **Likelihood:** Medium
- **Impact:** Lost work, wasted pipeline ticks
- **Mitigation:** Each agent works on a separate branch. Max 3 concurrent agents. Pull before every operation. Don't let multiple agents touch the same files.

### R7: Scope Creep
- **Likelihood:** High
- **Impact:** No version ever ships
- **Mitigation:** This document defines what's in each version. If it's not listed here, it waits. Lead is the only person who can add features to a milestone.

### R8: No Pilot Customer Interest
- **Likelihood:** Medium
- **Impact:** Building in a vacuum without feedback
- **Mitigation:** Start networking with local GCs now (the lead's industry contacts). Have v0.2.0 ready to demo by late March. Even if nobody signs up, the feedback from showing it is invaluable.

---

## Timeline Summary

| Version | Target | Key Milestone |
|---------|--------|---------------|
| v0.1.0 | Mid-Feb 2026 | Tag current state, fix known issues, CI green |
| v0.2.0 | Late Mar 2026 | Demo-ready for a real GC meeting |
| v0.5.0 | Jun 2026 | Pilot customer can use it on one project |
| v1.0.0 | Oct 2026 | Paying customers, public launch |

These dates assume:
- AI pipeline runs consistently (no extended outages)
- Lead maintains ~10-15 hours/week
- No major architecture rewrites are needed
- No major life events derail the schedule

If something slips, push the date. Do not cut quality gates to hit a date.

---

## What's NOT in v1.0

These are explicitly deferred to v2.0+:

- Payroll processing
- HR / workforce management
- Safety and compliance (inspections, incidents, OSHA)
- Equipment tracking
- BIM / 3D model viewer
- Offline/PWA support
- Native mobile apps
- AI features (chat, document analysis, cost prediction)
- ERP integrations beyond QuickBooks
- Multi-language support

They matter. They're planned. They're not v1.
