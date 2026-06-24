# Pitbull Construction Solutions - Documentation

## 📁 Document Organization

### `/architecture/`
Permanent architectural decisions, design patterns, and system requirements.

### `/deployment/`  
Deployment guides, environment configuration, and infrastructure setup.

### `/security/`
Security implementations, audit findings, and compliance documentation.

### `/archive/`
Historical reviews (e.g. 2026-02), early roadmaps, and superseded analysis. These are retained for context but **do not reflect current implemented state**. Always verify against `src/`, CHANGELOG.md, and running tests.

## 🔄 Document Lifecycle

**Active planning docs** (historically in /plans, /specs) → moved to archive/ when superseded; convert ongoing work to GitHub Issues.
**Permanent docs** (ARCHITECTURE.md, etc.) → Keep updated with actual code state  
**Historical analysis/reviews** → Archive to /archive  
**Outdated roadmaps/visions with hype or pre-implementation claims** → Archive

## 📋 Current Codebase Snapshot (as of 2026-05 / 0.15.0 per CHANGELOG)

- Modules: 14 (Core + 13 domain)
- Controllers: ~97
- EF Migrations: 155
- Test files: ~255-265
- Frontend: Next.js 16 + React 19
- Pattern: Direct service injection in controllers (no MediatR); MediatR retained only for some internal module registrations
- All queries filter `!IsDeleted`; tenant via RLS + set_config

**Key settled facts (do not relitigate):**
- Modular monolith + CAP event bus (not MassTransit)
- No MediatR in controllers
- Decimal (18,2) for money
- UTC DateTimes

Verify claims in any doc against live source (`dotnet build`, `ls src/Modules`, controller list, recent CHANGELOG entries).

---

*Outdated docs were moved during June 2026 audit for first-principles accuracy.*