# Phase 2 Scope: GPS Time Entry + Geofencing

## Overview
Location-verified time entry for prevailing wage compliance. Workers clock in/out from their phone, system records GPS coordinates, validates they're on the project site. Data flows to payroll and certified payroll (WH-347).

## Current State
- Time entry entity and crew-to-payroll workflow exist (6-phase: Draft → Submit → PM Review → Payroll → Export → Lock)
- GPS/Geofence on Time Entry module shipped in Phase 1 (Sprint 11, O5)
- WH-347 certified payroll PDF export shipped
- Mobile responsive layout exists

## Scope

### In Scope
1. **GPS capture on clock-in/out** — browser Geolocation API. Record lat/lon/accuracy at time entry start and end.
2. **Project geofence definition** — admin sets project center point + radius (default 500m). Stored on Project entity.
3. **On-site validation** — visual indicator: green (on-site), yellow (near site), red (off-site). Does NOT block entry — just flags for PM review.
4. **GPS compliance report** — for prevailing wage jobs: list of time entries with on-site/off-site status, exportable for Davis-Bacon audits.
5. **PM review integration** — GPS status visible during PM approval of time entries. Off-site entries highlighted for review.
6. **Privacy controls** — GPS collected only during clock events, not continuous tracking. Clear disclosure to users.

### Out of Scope
- Continuous GPS tracking / breadcrumb trails
- Automated clock-in when entering geofence (too unreliable on mobile)
- Equipment GPS tracking (separate feature, needs hardware)
- GPS for non-time-entry purposes

## Data Model Changes
```
TimeEntry (existing) — add fields:
  - ClockInLatitude (decimal, nullable)
  - ClockInLongitude (decimal, nullable)
  - ClockInAccuracy (decimal, nullable) — meters
  - ClockOutLatitude (decimal, nullable)
  - ClockOutLongitude (decimal, nullable)
  - ClockOutAccuracy (decimal, nullable)
  - GeofenceStatus (enum: OnSite, NearSite, OffSite, Unknown)

Project (existing) — add fields:
  - GeofenceCenterLatitude (decimal, nullable)
  - GeofenceCenterLongitude (decimal, nullable)
  - GeofenceRadiusMeters (int, default 500)
```

## API Changes
- `POST /api/time-entries` — accept optional GPS coordinates
- `GET /api/time-entries?geofenceStatus=OffSite` — filter by GPS status
- `PUT /api/projects/{id}/geofence` — set project geofence
- `GET /api/reports/gps-compliance?projectId={id}&dateRange=...` — GPS compliance report

## Acceptance Criteria
1. [ ] Worker can clock in from mobile, system captures GPS
2. [ ] If GPS unavailable (denied/indoor), entry still works — GeofenceStatus = Unknown
3. [ ] Project admin can set geofence center + radius on a map
4. [ ] Time entries show green/yellow/red GPS indicator
5. [ ] PM review screen highlights off-site entries
6. [ ] GPS compliance report exportable to PDF
7. [ ] GPS data retained for 90 days after pay period close, then deleted (per Data Classification Policy)
8. [ ] User is shown clear disclosure about GPS collection before first use
9. [ ] GPS accuracy below 100m triggers "Unknown" status (indoor/poor signal)
10. [ ] All GPS data respects tenant/company isolation

## Effort Estimate
- GPS capture + geofence validation: 1-2 days
- Project geofence UI (map): 1-2 days
- PM review integration: 0.5 day
- Compliance report: 1 day
- Privacy disclosure + data retention: 0.5 day
- Testing: 1 day
- **Total: 5-7 days**

## Dependencies
- Browser Geolocation API (supported in all modern mobile browsers)
- Map component for geofence setup (Leaflet or Mapbox — free tier)
