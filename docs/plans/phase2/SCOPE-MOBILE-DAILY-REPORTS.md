# Phase 2 Scope: Mobile Daily Reports + Photo Capture

## Overview
Enable field superintendents to create and submit daily reports from their phone, including photo attachments. This is the #1 field workflow and the highest-adoption feature for Phase 2.

## Current State
- Daily report entity, controller, service, and frontend page exist (Phase 1)
- File upload security validation shipped (blocked extensions, content-type, double-extension)
- Mobile bottom tabs and responsive layout shipped
- PWA scaffold exists (service worker, manifest)
- No blob storage backend yet (files go to local/default storage)

## Scope

### In Scope
1. **Photo capture from mobile browser** — camera access via `<input type="file" accept="image/*" capture="environment">`. No native app needed.
2. **Photo attachment to daily reports** — multiple photos per report, with captions
3. **Photo gallery view** — thumbnail grid on daily report detail page, tap to enlarge
4. **Auto-populate weather** — fetch from Open-Meteo API based on project GPS coordinates. Display temp, conditions, wind, precipitation.
5. **Blob storage backend** — S3-compatible abstraction (MinIO for self-hosted, S3 for cloud). Photos stored tenant-isolated.
6. **Photo compression** — client-side resize before upload (max 2048px, JPEG 80% quality). Reduces upload time on cellular.
7. **Offline draft** — save draft to localStorage if offline, sync when connection returns (PWA)

### Out of Scope
- Native iOS/Android app (PWA is sufficient for Phase 2)
- Video capture (future)
- Voice-to-text daily report dictation (deferred)
- AI photo analysis (future — "what's in this photo?")

## Data Model Changes
```
DailyReportPhoto
  - Id (Guid)
  - DailyReportId (FK)
  - BlobKey (string) — reference to blob storage
  - FileName (string)
  - Caption (string, nullable)
  - ContentType (string)
  - FileSizeBytes (long)
  - TakenAt (DateTime, nullable) — EXIF extraction
  - GpsLatitude (decimal, nullable) — EXIF extraction
  - GpsLongitude (decimal, nullable) — EXIF extraction
  - CreatedAt, CreatedBy (audit)
```

## API Endpoints
- `POST /api/daily-reports/{id}/photos` — upload photo(s), multipart/form-data
- `GET /api/daily-reports/{id}/photos` — list photos for a report
- `GET /api/daily-reports/{id}/photos/{photoId}` — get photo (presigned URL redirect)
- `DELETE /api/daily-reports/{id}/photos/{photoId}` — soft-delete photo
- `GET /api/weather?lat={lat}&lon={lon}&date={date}` — weather lookup

## Acceptance Criteria
1. [ ] Super can open daily report form on mobile Chrome/Safari
2. [ ] Tapping "Add Photo" opens device camera
3. [ ] Photos display as thumbnails on the report (before and after submission)
4. [ ] Photos are stored in blob storage, not database
5. [ ] Weather auto-populates when project has GPS coordinates
6. [ ] Weather can be manually overridden
7. [ ] Report can be saved as draft while offline and synced later
8. [ ] Photos are compressed client-side before upload
9. [ ] EXIF data (timestamp, GPS) is extracted and stored
10. [ ] All photo operations respect tenant/company isolation

## Effort Estimate
- Blob storage abstraction: 1-2 days
- Photo upload/display (backend + frontend): 2-3 days
- Weather API integration: 0.5 day
- Offline draft: 1 day
- Testing: 1-2 days
- **Total: 5-8 days**

## Dependencies
- Blob storage provider decision (S3 vs MinIO vs both)
- Project GPS coordinates populated in seed data
