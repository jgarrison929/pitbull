# Mobile Phase 3 (Arc C) — site walk & schedule notes

**Band:** 2.14.3 → 2.15.2  
**Status:** Shipped through 2.15.2  

## Test commands

```powershell
cd src/Pitbull.Web/pitbull-web
npm test -- --run site-walk-entry site-walk-analytics site-walk-twin-link schedule-critical-filter schedule-empty-copy progress-deep-link rfi-sub-link field-report-schedule-link
```

## Manual QA

1. Field home / project hub: **Today on this job** → site walk
2. Schedule look-ahead: critical filter + tap → progress draft
3. Sub card → RFIs with search
4. Twin link only when digitalTwin flag on
5. Field report `?activityId=` banner

## Version map

2.14.3 entry · 2.14.4 progress · 2.14.5 critical · 2.14.6 RFIs · 2.14.7 twin · 2.14.8 help · 2.14.9 analytics · 2.15.0 activity link · 2.15.1 empty · 2.15.2 checkpoint
