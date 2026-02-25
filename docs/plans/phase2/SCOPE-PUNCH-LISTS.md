# Phase 2 Scope: Punch List Enhancement

## Overview
Punch list module shipped in Phase 1 (entity, controller, service, frontend). Phase 2 enhances it with photo documentation, architect sign-off workflow, and mobile-optimized close-out experience.

## Current State
- Punch list entity exists with: location, category, description, responsible sub, status, priority
- PDF export exists (Punch List report via QuestPDF)
- Frontend page exists for CRUD
- No photo attachments yet
- No formal sign-off workflow

## Scope

### In Scope
1. **Photo attachments on punch items** — before/after photos. Uses same blob storage as daily report photos.
2. **Sign-off workflow** — Open → In Progress → Ready for Inspection → Accepted / Rejected. Architect or owner representative signs off.
3. **Batch operations** — select multiple items, assign to sub, change status, export filtered PDF
4. **Mobile camera integration** — same pattern as daily reports: capture photo, attach to punch item
5. **Location tagging** — floor/room/area picker (configurable per project)
6. **Close-out dashboard** — summary: X items open, Y in progress, Z accepted. Progress bar. Filter by sub/location/status.
7. **Sub notification** — email sub when punch items are assigned (via existing notification service + Resend)

### Out of Scope
- Drawing markup / pin-on-plan (Phase 4 with plan room)
- Architect portal access (Phase 6 owner/sub portals)
- QR code per punch item (future nice-to-have)

## Data Model Changes
```
PunchListItem (existing) — add fields:
  - Floor (string, nullable)
  - Room (string, nullable)
  - Area (string, nullable)
  - InspectedBy (string, nullable)
  - InspectedAt (DateTime, nullable)
  - SignOffNotes (string, nullable)

PunchListPhoto (new)
  - Id (Guid)
  - PunchListItemId (FK)
  - BlobKey (string)
  - FileName (string)
  - Caption (string, nullable)
  - PhotoType (enum: Before, After, During)
  - ContentType (string)
  - FileSizeBytes (long)
  - CreatedAt, CreatedBy (audit)
```

## Status Flow
```
Open → In Progress → Ready for Inspection → Accepted
                                           → Rejected → In Progress (loop)
```

## Acceptance Criteria
1. [ ] User can attach before/after photos to any punch item from mobile
2. [ ] Architect/inspector can sign off items (name + timestamp + notes)
3. [ ] Rejected items return to "In Progress" with rejection notes
4. [ ] Batch select + assign/status change works on list view
5. [ ] Close-out dashboard shows progress summary with filterable breakdown
6. [ ] Subs receive email when items are assigned to them
7. [ ] PDF export reflects current status + includes photo thumbnails
8. [ ] Location (floor/room/area) is filterable and sortable
9. [ ] All operations respect tenant/company/project isolation

## Effort Estimate
- Photo attachments (reuse daily report pattern): 1 day
- Sign-off workflow + status flow: 1-2 days
- Batch operations: 1 day
- Close-out dashboard: 1 day
- Sub notifications: 0.5 day
- Location tagging: 0.5 day
- Testing: 1 day
- **Total: 6-8 days**

## Dependencies
- Blob storage (shared with daily report photos)
- Resend email integration (already working)
