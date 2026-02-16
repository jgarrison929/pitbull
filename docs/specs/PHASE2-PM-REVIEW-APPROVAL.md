# Phase 2 Spec: PM Review and Approval Workflow (Crew-to-Payroll)

## Document Info
- Status: Draft
- Date: 2026-02-16
- Scope: Phase 2 only (PM Review)
- Depends on: Phase 1 Draft & Submit flow (`phase1-draft-submit-flow.md`)

---

## 1. Purpose
Phase 2 adds a production-grade **Project Manager (PM) review gate** between field submission and payroll processing.

This phase implements:
1. PM approval queue (grouped for fast review)
2. Line-level approve/reject with required comments on rejection
3. Foreman notifications for rejected entries
4. PM man-hours summary panel for cost/progress visibility

This phase does **not** implement PM adjustment dual-approval (that is Phase 3), payroll lock/processing (Phase 4), or post-lock adjustments (Phase 5).

---

## 2. Baseline and Constraints

### 2.1 Baseline from Phase 1
- Foreman can save drafts and submit entries for review.
- Core status lifecycle already supports: `Draft`, `Submitted`, `Approved`, `Rejected`.
- Existing transitions in service logic must remain valid.
- Existing numeric enum values must **not** change:
  - `Submitted = 0`
  - `Approved = 1`
  - `Rejected = 2`
  - `Draft = 3`

### 2.2 Explicit constraints
- No status re-indexing or enum renumbering.
- No payroll lock logic in Phase 2.
- No PM-adjusted dual-approval in Phase 2.
- Respect tenant isolation and existing auth model.
- Preserve current APIs where possible; add additive endpoints for queue and bulk actions.

---

## 3. Functional Requirements

### FR-1 PM approval queue
PM can open a queue of submitted entries filtered by:
- date range (default: current week)
- project
- foreman/supervisor
- status (default: submitted only)

Queue grouping:
- Group key: `SupervisorId + Date + ProjectId`
- Show summary per group:
  - total entries
  - total employees
  - total regular/OT/DT hours
  - submitted timestamp range

### FR-2 Line-level decisions
Within each group, PM can decide per entry line:
- Approve line
- Reject line (comment required, min length configurable)

Batch behavior:
- PM can submit mixed decisions in one request.
- Partial success allowed; response returns per-line results and failure reasons.

### FR-3 Rejection comments
Rejecting a line requires a reason visible to foreman.

Minimum data persisted per rejection comment:
- `TimeEntryId`
- `AuthorUserId` (PM)
- `CommentType` (`Rejection`)
- `Message`
- `CreatedAt`

### FR-4 Foreman feedback loop
When any line is rejected:
- rejected lines become editable by foreman according to current rules
- notification event is emitted for foreman inbox/toast
- PM comment is available in crew-entry UI on the line

### FR-5 PM man-hours summary
Queue page includes summary widgets for selected date range:
- total submitted hours
- total approved hours
- total rejected hours
- hours by project
- hours by cost code

Purpose: immediate operational insight for progress and labor-cost discussions.

---

## 4. User Flows

### 4.1 PM approves all lines
1. PM opens queue
2. selects group
3. clicks “Approve All”
4. backend transitions all submitted lines to approved
5. UI removes group from submitted queue

### 4.2 PM rejects specific lines
1. PM opens group
2. marks specific lines “Reject”
3. enters required reason per rejected line
4. submits review
5. rejected lines return to foreman with reasons

### 4.3 Mixed review (recommended default)
1. PM approves valid lines and rejects only exceptions
2. system applies each line action independently
3. response shows counts and failures

---

## 5. Data Model Changes

## 5.1 New entity: `TimeEntryComment`
Purpose: durable audit trail for PM rejection reasons and later workflow comments.

```csharp
public class TimeEntryComment : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid TimeEntryId { get; set; }
    public Guid AuthorUserId { get; set; }
    public TimeEntryCommentType CommentType { get; set; } // Rejection, Note (future)
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public enum TimeEntryCommentType
{
    Rejection = 0,
    Note = 1
}
```

EF requirements:
- table: `time_entry_comments`
- index: `(TimeEntryId, CreatedAt)`
- index: `(CompanyId, CreatedAt)`
- FK `TimeEntryId -> time_entries` with `Restrict`
- FK `AuthorUserId -> users` with `Restrict`
- `Message` max length 2000

### 5.2 Optional `TimeEntry` additions (if missing)
If not already present in schema from Phase 1, ensure:
- `SubmittedAt` `DateTime?`
- `SubmittedById` `Guid?`

No new statuses in Phase 2.

---

## 6. API Design

Base route: `/api/time-entries`

### 6.1 Queue endpoint
`GET /api/time-entries/review-queue`

Query params:
- `startDate` (required)
- `endDate` (required)
- `projectId` (optional)
- `supervisorId` (optional)
- `status` (optional; default submitted)

Response:
- grouped queue records with aggregate metrics and child lines

### 6.2 Bulk review endpoint
`POST /api/time-entries/review`

Request:
```json
{
  "decisions": [
    {
      "timeEntryId": "guid",
      "decision": "approve"
    },
    {
      "timeEntryId": "guid",
      "decision": "reject",
      "comment": "Wrong cost code. Move to 03-3000."
    }
  ],
  "reviewedById": "guid"
}
```

Response:
```json
{
  "total": 25,
  "approved": 20,
  "rejected": 4,
  "failed": 1,
  "results": [
    {
      "timeEntryId": "guid",
      "success": false,
      "errorCode": "INVALID_STATUS",
      "error": "Only submitted entries can be reviewed"
    }
  ]
}
```

Validation:
- max decisions per request: 500
- unique `timeEntryId`s in request
- reject requires non-empty comment
- only `Submitted` entries are reviewable

### 6.3 Line comments endpoint (read)
`GET /api/time-entries/{id}/comments`

Returns chronological comment history for line-level context in PM and foreman UIs.

---

## 7. MassTransit Contracts (Phase 2)

### 7.1 Commands
```csharp
public record ReviewTimeEntries(
    List<TimeEntryReviewDecision> Decisions,
    Guid ReviewedById
);

public record TimeEntryReviewDecision(
    Guid TimeEntryId,
    TimeEntryReviewDecisionType Decision,
    string? Comment
);

public enum TimeEntryReviewDecisionType
{
    Approve = 0,
    Reject = 1
}
```

### 7.2 Events
```csharp
public record TimeEntriesReviewed(
    Guid CompanyId,
    Guid ReviewedById,
    int ApprovedCount,
    int RejectedCount,
    DateTime ReviewedAt
);

public record TimeEntriesRejected(
    Guid CompanyId,
    Guid ForemanUserId,
    List<Guid> TimeEntryIds,
    DateTime RejectedAt
);
```

### 7.3 Consumer behavior
`ReviewTimeEntriesConsumer`:
- validates each decision
- applies status transition via service layer
- writes `TimeEntryComment` for each rejection
- emits summary event + per-foreman rejection events
- returns per-line outcome list (partial success supported)

Idempotency key:
- `CompanyId + ReviewedById + requestHash`

---

## 8. Service Layer Requirements

Add service methods (or MassTransit handlers wrapping service methods):
- `GetReviewQueueAsync(...)`
- `ReviewTimeEntriesAsync(...)`
- `GetTimeEntryCommentsAsync(timeEntryId)`

Core rules:
- only `Submitted -> Approved|Rejected`
- reject requires comment
- set `ApprovedById/ApprovedAt` when approved
- set `RejectionReason` when rejected (for backward compatibility)
- insert `TimeEntryComment` row for rejected decisions

Authorization:
- user must have PM/supervisor permission for the project/company scope

---

## 9. Frontend Scope

Page: `time-tracking/approval`

### 9.1 Queue UX
- group cards by foreman/date/project
- expandable line grid
- project/date/supervisor filters
- sticky summary bar with hour totals

### 9.2 Line actions
- approve toggle
- reject toggle + required comment textbox
- “Approve All” and “Clear Decisions” helpers
- submit review button with optimistic progress + result toast

### 9.3 Foreman-facing feedback
Crew entry page must display rejection reasons inline for rejected lines.

---

## 10. Notifications

Minimum Phase 2 behavior:
- Publish `TimeEntriesRejected` event per foreman for rejected items.
- If notification infrastructure is not ready, persist to an in-app notification table or log fallback.

Notification content:
- date/project context
- rejected line count
- first 1-2 rejection reasons preview
- deeplink to crew entry page for correction

---

## 11. Reporting and Summary Calculations

Summary aggregates should be computed server-side for consistency:
- total regular hours
- total OT hours
- total DT hours
- total labor hours
- by project
- by cost code

Do not rely only on frontend rollups from paged data.

---

## 12. Error Codes

Standardize API/consumer error codes:
- `NOT_FOUND`
- `INVALID_STATUS`
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `BATCH_LIMIT_EXCEEDED`
- `DUPLICATE_DECISION`

---

## 13. Acceptance Criteria

1. PM can view submitted queue grouped by foreman/project/date.
2. PM can approve all lines in a group.
3. PM can reject specific lines with required comments.
4. Mixed approve/reject in one submission works with per-line outcomes.
5. Rejected lines and comments appear to foreman for correction.
6. PM summary widgets show accurate hours by filter.
7. Status transitions enforce submitted-only review.
8. Audit trail (`TimeEntryComment`) persists and is queryable.
9. Multi-tenant boundaries are preserved.
10. Existing Phase 1 draft/submit behavior remains unchanged.

---

## 14. Test Plan

### Backend
- queue query grouping correctness
- review command happy path (all approve)
- mixed approve/reject
- reject without comment fails
- non-submitted entry review fails
- duplicate entry in one request fails
- max batch size enforcement
- comments persisted for each rejection
- events published (`TimeEntriesReviewed`, `TimeEntriesRejected`)

### Frontend
- filter behavior
- line decision state handling
- required comment validation for rejection
- successful submit state reset
- partial failure rendering
- rejection comments shown in crew entry view

---

## 15. Out of Scope (Phase 3+)
- PM adjustments requiring foreman + executive dual approval
- Payroll batch processing and immutability lock
- Post-lock payroll adjustments
- GL/job-cost posting

---

## 16. Implementation Order (Recommended)
1. Add `TimeEntryComment` entity + migration
2. Add queue read model/query endpoint
3. Add review command + consumer + bulk review endpoint
4. Add rejection comment retrieval endpoint
5. Implement approval UI with line-level actions
6. Wire rejection visibility into crew entry UI
7. Add summary panel and final polish
8. Add tests and rollout checklist

---

## 17. Rollout Notes
- Ship behind feature flag: `TimeTracking:PmReviewPhase2Enabled`
- Enable for pilot companies first
- Monitor:
  - review latency
  - rejection rate
  - resubmission cycle time
  - PM queue backlog age

