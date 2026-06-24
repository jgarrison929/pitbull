# Punch List Module — Design Specification (HISTORICAL)

> **Status:** Implemented in 0.15.0 (see CHANGELOG)
> **Module:** `Pitbull.ProjectManagement`
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-20 (implemented May 2026)
> **Note:** This is historical design. Punch List (PmPunchListItem + CRUD, seed, PDF report, summary cards, filters) shipped in 0.15.0. Basic status flow implemented; advanced photo/signoff per phase2 scope not fully in this doc's follow-on. Current code: ProjectManagement domain/entities/services, BillingApplicationsController? no, PM controllers, SeedDataService. Reference actual entities over this spec.

**Implemented as of June 2026 (verified):**
- Entity: PmPunchListItem + PmPunchListPhoto in ProjectManagement/Domain/ProjectManagementEntities.cs (fields: ItemNumber, Title, Location, Category (enum 10 vals), Description, ResponsiblePartyType, ResponsibleSubcontractorId, AssignedToName, DueDate, Status (Open/InProgress/ReadyForInspection/Closed/Disputed), Priority (Critical..), PhotoRequired, CostImpact, ScheduleImpactDays, Closed*/Inspected*, Notes).
- Enums: PunchListCategory, PunchListResponsiblePartyType, PunchListItemStatus, PunchListPriority (matches doc mostly).
- Controller: PunchListController in ProjectManagementControllers.cs (CRUD, close, summary, photos, PDF).
- Service: IPunchListService / impl in Services.cs (Create, List, Update, Delete, Close, Summary, photo attach/list).
- Seed: many PmPunchListItem in SeedDataService.cs (templates with statuses).
- PDF: GeneratePunchListPdfAsync.
- UI: /projects/[id]/punch-list/ page + summary cards, filterable table, dialogs (per changelog).
- CHANGELOG: "Punch List module — backend entities, API, migration, seed data, summary cards, filterable table, CRUD dialogs"; tests.
Photos exist (PmPunchListPhoto with GPS), retention link aspirational/not enforced yet? Basic workflow matches. Phase2 enhancements (batch, more signoff) partial. Verify services for any retention gating logic. (See also JobsController PDF handling.)

---

## 1. Purpose & Scope

Dedicated punch list entity for construction close-out. Connects deficiencies to responsible subs, their contracts, and retention release decisions. Key differentiator: retention can't be released while open punch items exist for that sub.

## 2. New Entity: PmPunchListItem (current as of 2026-06, see ProjectManagementEntities.cs)

```csharp
public class PmPunchListItem : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public int ItemNumber { get; set; }  // Auto-increment per project
    public string Title { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public PunchListCategory Category { get; set; }
    public string Description { get; set; } = string.Empty;
    public PunchListResponsiblePartyType ResponsiblePartyType { get; set; }
    public Guid? ResponsibleSubcontractorId { get; set; }
    public string? AssignedToName { get; set; }
    public DateTime? DueDate { get; set; }
    public PunchListItemStatus Status { get; set; }
    public PunchListPriority Priority { get; set; }
    public bool PhotoRequired { get; set; }
    public decimal? CostImpact { get; set; }
    public int? ScheduleImpactDays { get; set; }
    // ... ClosedByUserId, InspectedBy, Notes, etc.
}
```

Note: Design evolved (e.g. consolidated Location, added enums for Category/Responsible/Status/Priority, photos as separate PmPunchListPhoto with DocumentId + GPS). Retention gating via sub references is core idea but implementation details in services/migrations.

    // Classification
    public PunchListCategory Category { get; set; }  // Electrical, Plumbing, Finish, etc. (16 values)
    public PunchListPriority Priority { get; set; }   // Low, Normal, High, Critical
    public PunchListType Type { get; set; }           // Deficiency, Incomplete, Damage, CodeViolation, DesignIssue
    
    // Responsibility
    public Guid? ResponsibleSubcontractId { get; set; }
    public Guid? ResponsibleEmployeeId { get; set; }
    public string? ResponsiblePartyName { get; set; }
    
    // Workflow
    public PunchListStatus Status { get; set; }  // Open → InProgress → Complete → Verified (or Rejected → Open, WontFix)
    public DateTime? DueDate { get; set; }
    public DateTime? CompletedDate { get; set; }
    public DateTime? VerifiedDate { get; set; }
    public string? VerificationNotes { get; set; }
    
    // Cost tracking
    public decimal? EstimatedCost { get; set; }
    public decimal? ActualCost { get; set; }
    
    // Source
    public PunchListSource Source { get; set; }  // Walkthrough, Inspection, SelfInspection, OwnerRequest, Warranty
}
```

## 3. Status Workflow

Open → InProgress → Complete → Verified. Reject sends back to Open (requires notes). WontFix from any status (requires justification). Verify requires notes.

## 4. API Endpoints

- Full CRUD on `/api/projects/{projectId}/punch-list`
- Status transition endpoints (start, complete, verify, reject, wont-fix, reopen)
- Bulk status change and bulk assign
- Summary endpoint (counts by status/category/responsible party)
- PDF export (full list and sub-filtered)

## 5. Frontend Pages

- List view with filters, summary cards, bulk actions
- Detail view with photo gallery (before/after/reference), WorkflowStepper, location card
- Create/edit form with location autocomplete from existing items
- Mobile-optimized quick create (15-second target)

## 6. Photo Attachments

Reuse existing FileAttachment + FileDropZone + IFileValidationService. Photos tagged as Before/After/Reference.

## 7. Integration Points

- Subcontract detail → open punch item count
- Retention release gate → warning if open items exist for sub
- Dashboard widget → punch list summary for PM view
- PDF export via QuestPDF

## 8. Implementation Phases

Phase 1: Entity + CRUD + workflow + photos + list/detail pages + tests
Phase 2: PDF export + mobile quick-create + location autocomplete
Phase 3: Retention integration + sub notification + floor plan pins

---

*Addresses Executive Review concern C3 (VP of Construction).*
