# Punch List Module — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.ProjectManagement` (extends existing)
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-20
> **Sponsor:** VP of Construction (Tom Reilly)
> **Executive Review Reference:** "At project close-out, the PM walks the building with the architect and creates a punch list."

---

## 1. Purpose & Scope

Dedicated punch list entity for construction close-out. Connects deficiencies to responsible subs, their contracts, and retention release decisions. Key differentiator: retention can't be released while open punch items exist for that sub.

## 2. New Entity: PunchListItem

```csharp
public class PunchListItem : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public string ItemNumber { get; set; }  // Auto: PL-001, PL-002
    public string Description { get; set; }
    
    // Location
    public string? Building { get; set; }
    public string? Floor { get; set; }
    public string? Room { get; set; }
    public string? Area { get; set; }
    
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
