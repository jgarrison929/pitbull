# Pitbull Construction Solutions — Product Vision

## The problem

Construction operations still run on disconnected tools. A typical general contractor juggles project management, estimating, accounting, document control, and field apps that do not share a single source of truth. Data is re-entered across systems; retainage, SOV, and change-order state live in spreadsheets; executives lack a trustworthy portfolio view.

## The vision

**One platform. One login. One database.** Core GC workflows — preconstruction through closeout — share tenant-isolated data, consistent identity, and real-time operational metrics.

Pitbull is a modular construction ERP aimed at **commercial general contractors**: managing projects, subcontractors, cost, time, compliance paperwork, and owner billing without bolting together half a dozen point solutions.

## Product principles

### Domain-first for GCs

Features are shaped for how GCs work: jobs and cost codes, bids converting to projects, subcontracts with SOV and change orders, crew time against phases, RFIs/submittals/daily reports, and AIA-style payment applications.

### Multi-tenant SaaS architecture

PostgreSQL **row-level security**, company scoping, JWT + Identity roles and fine-grained permissions. Designed for multiple companies and strong tenant isolation.

### Role-native experience

Executives, controllers, project managers, and estimators land on homes and KPIs that match their job — with drill-through to filtered operational data (see `docs/ROLE-EXPERIENCE.md`).

### AI as leverage, not theater

Provider abstractions (Anthropic / OpenAI) for chat, project summaries, and document extraction where they reduce real administrative load. Capabilities ship behind clear APIs and usage tracking.

### Cloud-native delivery

Docker and Railway-ready containers, health checks, migrations on deploy, Hangfire background jobs, CAP outbox messaging.

## Platform status

Delivered surface area includes multi-tenant core, projects/bids/contracts, time tracking, project management, billing/GL/AP/AR elements, workflow approvals (Phase 1), reports, AI module, demo multi-company seeds, in-app changelog, and role-summary dashboards.

Authoritative sources:

| Source | Purpose |
|--------|---------|
| `CHANGELOG.md` + `VERSION` | What shipped and when |
| `docs/ARCHITECTURE.md` | System design |
| `src/Modules/*` | Domain implementation |
| `docs/ROLE-EXPERIENCE.md` | Persona UX |

## Stack

- **Backend:** .NET 10, modular monolith, controllers → services (no MediatR in controllers), EF Core 10, PostgreSQL 17 + RLS  
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui  
- **Messaging / jobs:** DotNetCore.CAP, Hangfire  
- **Email:** Resend (optional)  
- **Deploy:** Railway from `main`, Docker Compose for local and self-hosted  

## Direction

Continue deepening construction accounting fidelity (WIP, certified payroll, dual-book nuances), expanding workflow coverage beyond change orders and billing applications, and tightening executive metrics so every KPI answers *why* with drill-through lists.

**Differentiating horizon:** Jobsite Twin — field capture and ERP truth rendered as a spatial world model so humans and agents share one map of the work (zones-first, truthful overlays, cited agent briefs). Product design: `docs/pitbull-digital-twin-spec.md`. Capture engine: `docs/mobile3.md`.

---

*Pitbull Construction Solutions — one platform for the GC back office.*
