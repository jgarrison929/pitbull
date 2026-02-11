# Pitbull Construction Solutions - Project Schedule

**Last Updated:** 2026-02-10
**Owner:** Josh Garrison
**Status:** Alpha 0 Feature Complete, Awaiting UAT

---

## Current State

| Metric | Value |
|--------|-------|
| Version | v0.10.17 |
| Tests | 1017 (834 unit + 183 integration) |
| CI Status | ✅ Green |
| Production | Railway (auto-deploy from main) |
| Modules | Core, Projects, Bids, RFIs, TimeTracking, Employees, Reports, Contracts |

---

## Milestone Summary

| Milestone | Target | Status | Notes |
|-----------|--------|--------|-------|
| Alpha 0 | Feb 21 | ✅ Feature Complete (Feb 7) | 14 days early |
| UAT Environment | TBD | ⏳ Blocked | Need Railway staging setup |
| Alpha 1 | TBD | 📋 Planning | "Field Usable" |
| Beta | TBD | 📋 Future | "Job Cost is Real" |
| v1.0 | TBD | 📋 Future | "Platform Foundation" |

---

## ✅ Alpha 0 - "Labor Hits Job Cost" (COMPLETE)

**Goal:** Contractor can capture time, approve it, see labor cost rollups by job/cost code.

**Delivered:**
- [x] Projects module with cost code support
- [x] Employee management with rates/burden
- [x] Time entry with approval workflow (Draft → Submitted → Approved/Rejected)
- [x] Labor cost calculator (OT/DT/burden)
- [x] Cost rollups by project/cost code
- [x] Vista-compatible CSV export
- [x] Dashboard analytics
- [x] Contracts module (bonus) - Subcontracts, COs, Pay Apps

**Remaining:**
- [ ] UAT environment setup (blocked on Railway access)
- [ ] Demo data population
- [ ] User acceptance testing with 50+ time entries

---

## 🔜 Alpha 1 - "Field Usable" (PLANNING)

**Goal:** Field workers can use it daily without friction.

**Planned Features:**
- [ ] Mobile-first time entry UX (fast, large touch targets)
- [ ] Foreman crew batch entry
- [ ] Pay period boundaries (configurable)
- [ ] Overtime rules (basic policies)
- [ ] Audit trail enhancements
- [ ] Basic reporting exports

**Technical Debt:**
- [ ] UI component cleanup (97 tsx files need organization)
- [ ] Frontend test coverage
- [ ] API documentation/developer guide

**Prerequisites:**
1. Alpha 0 UAT complete
2. UI/UX review with real field scenarios
3. Plan doc before coding

---

## 📅 Beta - "Job Cost is Real" (FUTURE)

**Goal:** Forecast and validate performance, not just record history.

**Planned Features:**
- Production quantities
- Forecasting (hours at completion, cost at completion, trends)
- Integration profiles (Vista export templates, basic imports)

---

## 🎯 v1.0 - "Platform Foundation + Compliance" (FUTURE)

**Goal:** Real operating system for contractors.

**Planned Features:**
- Sub/vendor compliance dashboard (COI/licenses/certs)
- Document intelligence (OCR + semantic search)
- Contract ops assistant
- Role-based permissions (full)
- Tenant controls
- Audit logs

---

## Module Roadmap

Based on PRODUCT-VISION.md, here's the full module roadmap:

### Phase 1: Foundation (COMPLETE)
1. ✅ Core (multi-tenancy, auth, RBAC)
2. ✅ Projects
3. ✅ Bids
4. ✅ RFIs
5. ✅ TimeTracking
6. ✅ Employees
7. ✅ Reports
8. ✅ Contracts

### Phase 2: Documents & Portal
1. Documents module (S3 storage, versioning, search)
2. Portal (subcontractor self-service)
3. Billing (owner pay apps, AIA G702/G703)

### Phase 3: Full ERP
1. Accounting (AP, CM, GL)
2. HR (full Employee Master with 20 sub-modules)
3. System Admin (granular security)

### Phase 4: Advanced
1. Data Warehouse (OLAP, executive dashboards)
2. AI features (document processing, smart search, predictions)

---

## Weekly Rhythm

**Weeknights (when Josh available):**
- Review/merge PRs
- Planning discussions
- Feature prioritization

**Overnight Sessions (River):**
- Small PRs (1-3 per hour max)
- Test coverage
- Bug fixes
- Documentation
- Research analysis

**Weekends:**
- Larger feature work (with plan docs)
- UI development
- Integration work

---

## Blockers (Current)

| Blocker | Impact | Owner | Since |
|---------|--------|-------|-------|
| Railway staging/dev setup | UAT blocked | Josh | Feb 1 |
| ClawHub auth | Skill publishing | Josh | Feb 1 |

---

## Review Cadence

- **Daily:** Check CI, production health
- **Weekly:** Progress summary, blocker review
- **Monthly:** Milestone review, roadmap adjustment

---

## Links

- **Research Index:** `/mnt/c/research/RESEARCH-INDEX.md`
- **Product Vision:** `/mnt/c/pitbull/docs/PRODUCT-VISION.md`
- **Alpha 0 Roadmap:** `/mnt/c/pitbull/docs/ALPHA-0-ROADMAP.md`
- **Plan Template:** `/mnt/c/pitbull/docs/plans/TEMPLATE.md`
