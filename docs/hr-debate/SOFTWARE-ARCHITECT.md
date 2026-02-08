# HR Core Technical Architecture Position Paper
**Author:** Software Architect  
**Date:** 2026-02-08

## Executive Summary

HR Core must become the **single source of truth** for employee identity across Pitbull. This means absorbing TimeTracking's thin Employee entity while maintaining backward compatibility and establishing clean module boundaries. The architecture must support legal compliance, multi-tenancy, and AI agent automation from day one.

## Module Boundaries & Integration

### HR Core as Identity Authority

HR Core owns the **canonical Employee aggregate**. TimeTracking and all future modules become consumers via:

1. **Domain Events** (preferred) - `EmployeeHired`, `EmployeeTerminated`, `EmployeeTransferred`
2. **Read-only projections** - Thin DTOs published to a shared schema for cross-module queries
3. **Anti-corruption layer** - TimeTracking maintains its own `TimeTrackingEmployee` projection, synced via events

```
┌─────────────────────────────────────────────────────────┐
│                      HR Core Module                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Employee Aggregate                  │    │
│  │  - EmployeeId (strongly-typed ID)               │    │
│  │  - TenantId (isolation key)                     │    │
│  │  - PersonalInfo (value object)                  │    │
│  │  - Employment (value object: status, dates)     │    │
│  │  - Certifications[]                             │    │
│  │  - EmergencyContacts[]                          │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                    publishes                             │
│                         ▼                                │
│              [Domain Events via MediatR]                 │
└─────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
   TimeTracking      Payroll         Safety Module
   (subscriber)     (future)          (future)
```

### Schema Isolation

Each tenant gets logical isolation via `tenant_id` on every table with row-level security (RLS) in PostgreSQL:

```sql
CREATE POLICY tenant_isolation ON hr.employees
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

## Audit Trail Architecture

HR data carries legal weight—termination records, disciplinary actions, and certifications can become evidence. Every mutation must capture:

- **Who** (user ID + agent ID if automated)
- **When** (UTC timestamp)  
- **What changed** (before/after JSON diff)
- **Why** (command correlation ID linking to business context)

Implementation: Event sourcing for Employee aggregate with snapshotting every 50 events. This gives us complete audit history without complex CDC infrastructure.

## API Design for Agent Automation

AI agents will call these endpoints. Design principles:

1. **Idempotent operations** with client-supplied correlation IDs
2. **Bulk endpoints** - Agents often process batches: `POST /api/hr/employees/bulk-certifications`
3. **Deterministic responses** - Same input = same output (no random IDs in responses, use correlation-based)
4. **Rich error schemas** - Structured errors agents can parse, not just strings

```csharp
// Command designed for agent consumption
public record UpdateCertificationCommand(
    Guid CorrelationId,      // Agent-supplied, enables idempotency
    Guid EmployeeId,
    string CertificationType,
    DateOnly ExpirationDate,
    string? DocumentUrl
) : IRequest<Result<CertificationUpdated>>;
```

## Migration Strategy

1. **Phase 1:** Deploy HR Core with new Employee aggregate. TimeTracking continues using its entity.
2. **Phase 2:** Background migration job copies existing employees → HR Core (with full audit trail of migration).
3. **Phase 3:** TimeTracking subscribes to HR Core events, maintains read projection.
4. **Phase 4:** Deprecate TimeTracking.Employee writes, redirect to HR Core commands.
5. **Phase 5:** Drop TimeTracking.Employee table after 90-day verification period.

## Performance Considerations

For 1000+ employee workforces:
- **Materialized views** for common queries (active employees by department)
- **Partitioning** by tenant_id for large multi-tenant deployments
- **Read replicas** for reporting queries
- **Pagination mandatory** on all list endpoints (cursor-based, not offset)

---

## TOP 3 NON-NEGOTIABLE REQUIREMENTS

1. **Event Sourcing for Employee Aggregate** - We cannot compromise on audit trail completeness. Every state change must be reconstructible. This is a legal necessity for HR data.

2. **Tenant Isolation at Database Level (RLS)** - Application-level filtering is insufficient. PostgreSQL Row-Level Security must enforce tenant boundaries. A bug in application code must not leak employee PII across tenants.

3. **Idempotent, Correlation-ID-Based APIs** - Agent automation requires deterministic, retry-safe operations. Every write endpoint must accept a client-supplied correlation ID and return consistent results on replay.
