# CI notes — Band 3.7 Schedule Gantt + Kanban

**Status:** Shipped (3.7.0 checkpoint)  
**Spec:** `docs/specs/product-bands/band-3.7-pm-schedule-gantt-kanban.md`

## Product evidence

| Surface | Evidence |
|---------|----------|
| Slim activity list API | `GET …/schedules/{id}/activities?view=mobile` → `ActivityMobileListItemDto` |
| Phone look-ahead | Project schedule page uses `scheduleActivitiesMobileUrl` + honest empty |
| CPM labels (into 3.8) | `criticalLabel`, `formatFloatDays`, data-date on look-ahead |
| Help | `help-pm-schedule` section on Help Center |
| Unit | `ActivityMobileListMapperTests`, `schedule-mobile-list.test.ts` |

## Preflight

Run `./scripts/preflight.ps1 -FullWeb -DotNet` before merge.
