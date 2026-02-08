# HR Core Module Specification

**Version:** 1.0 Draft  
**Date:** February 8, 2026  
**Status:** Ready for Review

---

## Executive Summary

HR Core is the employee data warehouse for Pitbull Construction Solutions. It serves as the **single source of truth** for employee identity, enabling downstream modules (Payroll, Job Costing, Reporting) to function correctly.

### Why HR Core First?

```
HR Core (employees exist)
    ↓
Payroll (calculate pay for employees)
    ↓
Job Costing (cost labor to projects)
    ↓
Accounting (report financials)
```

You can't cost labor without employees. You can't run payroll without employees. HR Core is the foundation.

---

## Specification Documents

| Document | Purpose | Size |
|----------|---------|------|
| [01-ENTITIES.md](./01-ENTITIES.md) | Domain model, entities, relationships, indexes | ~108 KB |
| [02-API-ENDPOINTS.md](./02-API-ENDPOINTS.md) | REST API design, request/response schemas | ~45 KB |
| [03-CQRS-HANDLERS.md](./03-CQRS-HANDLERS.md) | Commands, queries, validators, domain events | ~74 KB |
| [04-COMPLIANCE-INTEGRATION.md](./04-COMPLIANCE-INTEGRATION.md) | EEO, E-Verify, doc storage, audit, state rules | ~63 KB |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Union support | Full (dispatch, apprentice, fringe) | Construction reality |
| Document storage | Build our own | Control + compliance |
| I-9 verification | E-Verify integration | Federal contractor requirement |
| State coverage | All 50 states from day 1 | National market |
| Audit approach | Event sourcing + immutable logs | Legal defensibility |
| EEO data | Segregated PostgreSQL schema | OFCCP compliance |
| Tenant isolation | PostgreSQL RLS | Defense in depth |

---

## Core Entities

### Primary Entities (HR Core owns)
1. **Employee** — Aggregate root, 100+ fields
2. **EmploymentEpisode** — Rehire-first employment history
3. **Certification** — With expiration tracking and hard stops
4. **PayRate** — Multi-dimensional (project, classification, wage det, shift)
5. **WithholdingElection** — Federal W-4 + 50 state variants
6. **Deduction** — With garnishment priority ordering
7. **EmergencyContact**
8. **EmployeeDocument** — With retention enforcement
9. **UnionMembership** — Dispatch, apprentice tracking, fringe
10. **I9Record** — Section 1/2/3 with retention calculation
11. **EVerifyCase** — Full DHS case workflow

### Reference Entities
- CertificationType, UnionLocal, DeductionType, DocumentType, WageDetermination, JobClassification

### Segregated (EEO Schema)
- EmployeeDemographics, EEO1JobCategories, ApplicantFlowLog

---

## Integration Points

### HR Core → TimeTracking
- **Domain Events:** EmployeeHired, EmployeeTerminated, CertificationExpired
- **API:** `GET /employees/{id}/can-work` validates active status + certs before time entry

### HR Core → Payroll (Future)
- **API:** `GET /employees/{id}/pay-rate` resolves correct rate by project/shift/date
- **API:** `GET /employees/{id}/tax-jurisdictions` returns applicable tax codes
- **API:** `GET /employees/{id}/deductions` returns active deductions with priority

### HR Core → Projects (Future)
- **API:** `POST /certifications/verify-bulk` validates crew for project mobilization
- **API:** `GET /employees/{id}/payroll-data` for certified payroll reports

---

## Implementation Phases

### Phase 2A: Foundation (2-3 weeks)
- [ ] Employee aggregate with core fields
- [ ] Certification entity with expiration tracking
- [ ] PayRate entity with effective dating
- [ ] Domain events infrastructure
- [ ] RLS policies for tenant isolation
- [ ] Basic audit logging

**Exit Criteria:** Can create/update employees, add certifications, set pay rates. All operations logged.

### Phase 2B: Compliance Layer (1-2 weeks)
- [ ] Segregated EEO schema with role-based access
- [ ] I-9 record tracking
- [ ] E-Verify integration (API client + case workflow)
- [ ] Document storage system
- [ ] Retention policy enforcement

**Exit Criteria:** Can collect EEO data separately, track I-9s, submit E-Verify cases, store documents with retention.

### Phase 2C: TimeTracking Integration (1 week)
- [ ] Domain event publishers
- [ ] TimeTracking event subscribers
- [ ] `can-work` validation API
- [ ] Migration job (existing employees → HR Core)
- [ ] Deprecate TimeTracking.Employee writes

**Exit Criteria:** TimeTracking uses HR Core as employee source of truth.

### Phase 2D: Payroll-Ready APIs (1-2 weeks)
- [ ] Pay rate resolution API (handles multi-rate complexity)
- [ ] Tax jurisdiction service (50-state rules)
- [ ] Withholding/deduction query APIs
- [ ] Bulk operations for agent automation
- [ ] Union fringe reporting queries

**Exit Criteria:** Payroll module can be built on top of HR Core APIs.

---

## Non-Negotiables Checklist

From the 4-agent design debate, these 12 items are mandatory:

- [ ] Certification tracking with hard stops (can't log time without valid certs)
- [ ] Employment episode history (rehire-first for 60% turnover)
- [ ] Prevailing wage classification mapping (Davis-Bacon foundation)
- [ ] Event sourcing for audit trail (legal requirement)
- [ ] RLS tenant isolation (database-level security)
- [ ] Idempotent APIs with correlation IDs (agent automation)
- [ ] Segregated EEO data storage (OFCCP compliance)
- [ ] Automated retention enforcement (can't do manually at scale)
- [ ] Immutable audit logging for 7 years (audit survival)
- [ ] Effective-dated multi-rate pay structure (construction reality)
- [ ] Tax jurisdiction resolution service (HR owns 50-state complexity)
- [ ] W-4 + deduction records with effective dates (payroll foundation)

---

## Open Items

1. **E-Verify API credentials** — Need DHS E-Verify Web Services account
2. **State tax withholding forms** — Need to source all 50 state W-4 equivalents
3. **Union locals database** — Initial seed data for common construction unions
4. **Wage determination import** — SAM.gov data feed for Davis-Bacon rates

---

## Appendix: File Locations

```
/mnt/c/pitbull/docs/
├── hr-debate/
│   ├── HR-DOMAIN-EXPERT.md      # Position paper
│   ├── SOFTWARE-ARCHITECT.md    # Position paper
│   ├── COMPLIANCE-OFFICER.md    # Position paper
│   ├── PAYROLL-SPECIALIST.md    # Position paper
│   └── SYNTHESIS.md             # Consolidated requirements
└── hr-spec/
    ├── 00-OVERVIEW.md           # This file
    ├── 01-ENTITIES.md           # Domain model
    ├── 02-API-ENDPOINTS.md      # REST API
    ├── 03-CQRS-HANDLERS.md      # Commands/queries
    └── 04-COMPLIANCE-INTEGRATION.md  # Compliance
```

---

*This specification is ready for implementation. Phase 2A can begin immediately.*
