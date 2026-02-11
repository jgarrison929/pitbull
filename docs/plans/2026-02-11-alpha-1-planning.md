# Plan: Alpha 1 "Field Usable" Planning

**Date:** 2026-02-11
**Status:** Planning

## Goal
Define scope and approach for Alpha 1, the "Field Usable" milestone that makes Pitbull practical for daily field operations.

## Context
Alpha 0 is feature complete (14 days early). Before diving into code, we need a clear plan for what "field usable" actually means and how to get there efficiently.

## Alpha 1 Theme: "Field Usable"

Workers can use Pitbull daily without friction. This means:
- Fast, mobile-friendly time entry
- Foreman batch entry for crews
- Clear pay period workflows
- Reliable approval processes

## Proposed Features

### P0 - Must Have

1. **Mobile-First Time Entry UX**
   - Large touch targets (minimum 44x44px)
   - Minimal taps to enter time (goal: 3-4 taps)
   - Offline-capable (queue entries, sync when connected)
   - Quick-select for recent projects/cost codes

2. **Foreman Crew Batch Entry**
   - Enter time for multiple workers at once
   - Copy yesterday's assignments
   - Bulk submit for approval

3. **Pay Period Boundaries**
   - Configurable pay periods (weekly, bi-weekly, semi-monthly)
   - Period lock dates (no edits after lock)
   - Period-based reporting views

### P1 - Should Have

4. **Overtime Rules (Basic)**
   - Daily OT threshold (default: 8 hours)
   - Weekly OT threshold (default: 40 hours)
   - Auto-calculate OT/DT splits
   - California rules as default (can disable)

5. **Audit Trail Enhancements**
   - Track all status changes with timestamps
   - Track who edited what, when
   - Compliance report for auditors

6. **Basic Reporting Exports**
   - Pay period summary by employee
   - Project labor report
   - Cost code analysis

### P2 - Nice to Have

7. **Geolocation Check-In (Optional)**
   - Record GPS on time entry
   - Job site radius validation
   - Audit trail for location

8. **Photo Attachments**
   - Attach photo to time entry
   - Progress documentation

## Technical Debt to Address

1. **UI Component Cleanup**
   - 97 tsx files need organization
   - Consolidate duplicate components
   - Create component library/storybook

2. **Frontend Test Coverage**
   - Currently 0 frontend tests
   - Add critical path tests (login, time entry, approval)
   - Use Playwright or Cypress

3. **API Documentation**
   - Swagger docs need verification
   - Add request/response examples
   - Create developer quickstart guide

## Approach

### Phase 1: UX Research (1-2 days)
- Review existing time entry flow
- Identify friction points
- Sketch mobile-first designs
- Define tap count targets

### Phase 2: Mobile Time Entry (1 week)
- Implement responsive time entry form
- Add recent projects/cost codes quick-select
- Optimize for thumb-zone navigation
- Add optimistic UI updates

### Phase 3: Foreman Batch Entry (3-4 days)
- Create crew selection interface
- Build batch entry grid
- Add "copy yesterday" feature
- Implement bulk submit

### Phase 4: Pay Periods (3-4 days)
- Add pay period configuration UI
- Implement period boundaries
- Add lock date enforcement
- Build period-based views

### Phase 5: OT Rules (2-3 days)
- Add overtime configuration
- Implement calculation engine
- Update time entry display
- Handle edge cases

### Phase 6: Polish & Testing (1 week)
- UI cleanup and consistency
- Add frontend tests
- Documentation updates
- UAT with test users

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep | High | Stick to P0 for first release, P1/P2 can slip |
| Mobile testing | Medium | Test on actual devices, not just responsive mode |
| Offline complexity | High | MVP can be online-only, add offline later |
| OT rule complexity | Medium | Start with simple rules, add complexity gradually |

## Test Plan

### Unit Tests
- [ ] Pay period boundary calculations
- [ ] Overtime calculation engine
- [ ] Batch entry validation

### Integration Tests
- [ ] Time entry → approval workflow
- [ ] Pay period lock enforcement
- [ ] Batch submit for crew

### Manual Testing
- [ ] Mobile time entry on iPhone/Android
- [ ] Foreman batch entry flow
- [ ] Pay period reporting

## Success Criteria

1. Time entry in ≤4 taps on mobile
2. Foreman can enter crew time in <5 minutes
3. Pay periods are enforceable (no edits after lock)
4. OT calculations match expected values
5. All P0 features have test coverage

## Dependencies

- Alpha 0 UAT feedback (haven't received yet)
- Railway staging environment (blocked on #119, #120)
- Design review for mobile UX

## Timeline Estimate

With 15+ hours/week dev time:
- Phase 1-2: Week 1
- Phase 3-4: Week 2
- Phase 5-6: Week 3-4

**Target:** Alpha 1 complete by ~March 15, 2026

## Open Questions

1. Do we need offline support in Alpha 1, or can that be Alpha 2?
2. What pay period configurations are most common? (Ask Josh)
3. Should overtime rules be tenant-configurable or job-configurable?
4. Do we need mobile app or is responsive web sufficient for Alpha 1?

## Artifacts
- This planning doc

## Outcome
_To be filled in after Alpha 1 ships_
