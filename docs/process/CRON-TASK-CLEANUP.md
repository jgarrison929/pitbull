# Cron Task Cleanup (2026-02-04)

## Goal
Update stale cron job prompts that reference old PR numbers and outdated priorities.

## Changes Made
- Updated `pitbull-hourly-focus-tick` to remove references to obsolete PRs (#89/#90/#91) and focus on current reality: small PRs, stable develop, Josh's testing prep.

## Current Cron Jobs (after cleanup)
1. **spending-monitor** (every 30 min) — spending safety check
2. **pitbull-hourly-focus-tick** (hourly) — updated with current priorities  
3. **pitbull-slow-steady-issues-features** (every ~4 hours, 6am-9pm) — planning + deliverables
4. **memory-maintenance** (2 jobs: every 4h + 8am/8pm) — duplicate, should consolidate
5. **pitbull-overnight-full-send** (10pm-5am) — isolated session overnight work

## Recommendations
- Keep jobs 1, 2, 3, 5
- Consolidate the two memory-maintenance jobs into one
- All prompts now reference current state (not stale PR numbers)