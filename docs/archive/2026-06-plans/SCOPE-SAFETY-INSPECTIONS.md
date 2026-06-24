# Phase 2 Scope: Safety Inspections

## Overview
Configurable safety inspection checklists for jobsite compliance. Supers complete inspections on mobile, results are linked to projects and daily reports. Photos of violations. Auto-generate corrective action items.

## Current State
- No safety inspection module exists
- Daily report entity exists (can reference safety conditions in notes)
- Notification service exists (can alert on violations)
- Photo infrastructure will exist after daily report photos are built

## Scope

### In Scope
1. **Inspection templates** — admin-configurable checklists. Categories: fall protection, scaffolding, electrical, excavation, PPE, housekeeping, fire protection. Each item: pass/fail/NA + notes + photo.
2. **Mobile inspection form** — super walks site, checks items, takes photos of violations, submits.
3. **Corrective actions** — failed items auto-generate corrective action records: description, responsible party, due date, status (Open → Corrected → Verified).
4. **Inspection history** — per-project log of all inspections. Trend view: pass rate over time.
5. **Daily report link** — inspections reference the date and project, can be linked from daily reports.
6. **OSHA recordkeeping** — inspection records retained per OSHA 29 CFR 1904 (5-30 years depending on type).
7. **PDF export** — individual inspection report + corrective actions summary.

### Out of Scope
- OSHA 300 log generation (separate compliance module, future)
- Toolbox talk content management
- Training record tracking
- Near-miss reporting (future)

## Data Model

```
SafetyInspectionTemplate
  - Id (Guid)
  - TenantId, CompanyId (scoping)
  - Name (string)
  - Category (string)
  - IsActive (bool)
  - Items: List<SafetyInspectionTemplateItem>

SafetyInspectionTemplateItem
  - Id (Guid)
  - TemplateId (FK)
  - Description (string)
  - Category (string)
  - SortOrder (int)

SafetyInspection
  - Id (Guid)
  - TenantId, CompanyId, ProjectId (scoping)
  - TemplateId (FK)
  - InspectedBy (string)
  - InspectedAt (DateTime)
  - WeatherConditions (string, nullable)
  - Notes (string, nullable)
  - Status (enum: Draft, Submitted, Reviewed)
  - PassRate (decimal) — calculated
  - Items: List<SafetyInspectionItem>

SafetyInspectionItem
  - Id (Guid)
  - InspectionId (FK)
  - TemplateItemId (FK)
  - Result (enum: Pass, Fail, NA)
  - Notes (string, nullable)
  - Photos: List<SafetyInspectionPhoto>

SafetyInspectionPhoto
  - Id (Guid)
  - InspectionItemId (FK)
  - BlobKey, FileName, ContentType, FileSizeBytes (same pattern)

CorrectiveAction
  - Id (Guid)
  - InspectionItemId (FK, nullable)
  - ProjectId (FK)
  - Description (string)
  - ResponsibleParty (string)
  - DueDate (DateTime)
  - Status (enum: Open, InProgress, Corrected, Verified)
  - VerifiedBy (string, nullable)
  - VerifiedAt (DateTime, nullable)
  - Notes (string, nullable)
```

## Acceptance Criteria
1. [ ] Admin can create/edit inspection templates with categorized checklist items
2. [ ] Super can start inspection from mobile, check items pass/fail/NA
3. [ ] Failed items prompt for photo + notes
4. [ ] Failed items auto-generate corrective action records
5. [ ] Corrective actions have assignee, due date, and status workflow
6. [ ] Inspection history shows per-project timeline with pass rate trend
7. [ ] PDF export includes checklist results + violation photos
8. [ ] Inspection linked to project + date (referenceable from daily report)
9. [ ] OSHA retention requirements enforced (minimum 5 years)
10. [ ] Default templates provided for common inspection types (5+ templates in seed data)

## Effort Estimate
- Template CRUD (backend + frontend): 2 days
- Inspection form (mobile-optimized): 2-3 days
- Corrective actions workflow: 1-2 days
- History/trend view: 1 day
- PDF export: 1 day
- Seed data templates: 0.5 day
- Testing: 1-2 days
- **Total: 8-11 days**

## Dependencies
- Blob storage (shared infrastructure)
- Photo upload pattern (from daily reports)
