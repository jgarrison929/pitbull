# Pitbull Construction Solutions — Issue/Resolution History

> **Generated:** February 19, 2026
> **Scope:** February 1–19, 2026 (v0.10.16 → v0.13.0)
> **Total Issues Created:** 21
> **Commits Reviewed:** 945 (private repo) + 50 (public repo)

## Overview

This document catalogs the retroactive issue documentation for Pitbull Construction Solutions. Prior to this effort, most of the 260+ merged PRs lacked corresponding GitHub issues. These 21 issues document the most significant bugs, security vulnerabilities, and production incidents from February 2026.

## Labels Created

| Label | Color | Description |
|-------|-------|-------------|
| `bug` | #d73a4a | Something isn't working (pre-existing) |
| `security` | #B60205 | Security vulnerability or hardening |
| `hotfix` | #FF4500 | Production hotfix |
| `production` | #FFA500 | Affected production environment |
| `testing` | #0E8A16 | Test suite fixes |
| `infrastructure` | #5319E7 | CI/CD, deployment, Docker |
| `documentation` | #0075ca | Improvements or additions to documentation (pre-existing) |

---

## Security Issues (Critical)

| # | Title | Labels | PRs/Commits |
|---|-------|--------|-------------|
| #261 | SQL Injection vulnerability in SystemHealthService | bug, security | PR #250 |
| #262 | Bootstrap-admin privilege escalation — admin endpoint remains open after first admin created | bug, security | PR #203 |
| #263 | API error handling leaks internal exception messages to clients | bug, security | PR #253 |
| #264 | AI module security hardening — prompt injection and input validation | bug, security | PRs #160, #204, #199, #220 |

## Production Incidents

| # | Title | Labels | PRs/Commits |
|---|-------|--------|-------------|
| #266 | Recurring 500 errors from DateTime UTC normalization failures | bug, production | PR #238 |
| #267 | DbContext concurrent access causing intermittent 500 errors on dashboard and search | bug, production | PRs #218, #219 |
| #268 | PostHog-reported production API errors — two rounds of fixes (12+ bugs) | bug, production | PRs #180-#187, #189-#193, #211-#215, #217 |
| #269 | MassTransit 9.0.1 upgrade broke production — requires commercial license | bug, hotfix | Hotfix revert + PR #221 |
| #270 | DemoBootstrapper crashes on startup — multiple seed data failures | bug, production | Multiple commits |
| #276 | Production bugs — subcontract dates, bids payload, data protection keys, and FK constraints | bug, production | PRs #222, #223, #227 |

## Infrastructure & CI Issues

| # | Title | Labels | PRs/Commits |
|---|-------|--------|-------------|
| #271 | EF Core migration failures — duplicate tables, RLS policy conflicts, and column type mismatches | bug, infrastructure | PR #151 + multiple commits |
| #272 | Docker build failures — missing module COPY lines in Dockerfile | bug, infrastructure | Multiple commits |
| #274 | CI/test suite failures — 30+ test failures from constructor mismatches and integration issues | bug, testing | PRs #198, #202, #225, #241 |
| #277 | PostHog telemetry reverted and re-implemented — NEXT_PUBLIC env var build issue | bug, infrastructure | Multiple commits |
| #287 | Public repo — health check endpoint returning malformed response | bug, infrastructure | Public PR #179 |

## Application Bugs

| # | Title | Labels | PRs/Commits |
|---|-------|--------|-------------|
| #265 | Audit log export uses raw localStorage token instead of API client auth helpers | bug | PR #258 |
| #273 | Soft-delete filters missing on multiple services — deleted records visible to users | bug | Multiple commits |
| #275 | Signup flow data loss — industryType and employeeRange not persisted | bug | PRs #230-#232 |
| #278 | Resend email integration — non-blocking sends and whitespace API key validation | bug | PR #206 |
| #279 | Demo-critical UX fixes — mobile nav, admin gates, table scroll, registration flow | bug | PRs #196, #228, #239, #252 |
| #280 | Refresh token not generated on invitation acceptance | bug | PR #259 |
| #281 | Sidebar active-link detection broken + cost codes sorting/pagination not working | bug | PRs #226, #166 |
| #282 | Week-start inconsistency, CSV escaping, and timecard settings page issues | bug | PRs #174, #233 |
| #283 | Admin roles/tenant prefix stripping and RBAC edge cases | bug | PRs #131, #161 |
| #284 | Build warnings cleanup — 0 backend warnings, 0 frontend lint warnings | bug, documentation | PRs #246, #224 |
| #285 | Crew entry returns 404 instead of empty result when no employee matches | bug | PR #149 |
| #286 | User name validation — truncation and length limits missing on users table | bug | Commit `6cb00fa` |

---

## Methodology

Issues were created retroactively by analyzing:
1. **Git commit history** (945 commits since Feb 1, 2026)
2. **PR merge messages** for context on related changes
3. **Commit message prefixes** (`fix:`, `hotfix:`, `security:`, `revert:`)
4. **Grouping strategy**: Related fixes were combined into single issues to create meaningful documentation rather than 1:1 commit-to-issue mapping

All issues were created in the closed state since the work is already complete.

## Key Takeaways

1. **Security was addressed proactively** — SQL injection, privilege escalation, API info leaks, and AI safety were all caught and fixed
2. **PostHog telemetry was transformative** — Once deployed, it revealed 12+ previously invisible production bugs
3. **DateTime UTC normalization was the #1 production issue** — Systemic fix resolved the most common error category
4. **DbContext thread-safety** is a recurring .NET/EF Core gotcha that caused hard-to-reproduce intermittent failures
5. **Docker and migration issues** are the most common deployment blockers
6. **Test maintenance debt** accumulated rapidly during fast feature development — addressed with targeted fix sprints
