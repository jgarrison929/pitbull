# Roadmap — v2.1.0 Role-native experience

**Status:** Shipped as **2.1.0** (2026-07-10).

## Goals

1. Fix persona truth (CEO is not PM briefing).  
2. Executive / CFO homes with **truthful** financial and risk metrics.  
3. Estimator bid-centric home.  
4. Nav defaults by `role_profile`.  
5. Docs hygiene (ARCHITECTURE, AGENTS, this file, ROLE-EXPERIENCE).

## Workstreams

| ID | Scope | Status |
|----|--------|--------|
| WS0 | RoleProfileResolver + briefing + layout + JWT claims | Done |
| WS1 | CEO executive dashboard + role-summary API | Done |
| WS2 | CFO controller dashboard (real aging) | Done |
| WS3 | Estimator layout + briefing | Done |
| WS4 | Nav / login copy | Done |
| WS5 | Docs | Done |
| WS6 | Full test matrix + VERSION 2.1.0 cut | Done |

## Out of scope

Full cash-flow statement, bonding packages, multi-company consolidated board view, full job-cost replacement for labor proxies.

## Ship checklist

- [x] Unit tests green (persona matrix + role-summary + briefing)  
- [x] VERSION / package.json / csproj / CHANGELOG `[2.1.0]`  
- [ ] Optional: Manual Explore-as-role matrix on Railway after deploy  

