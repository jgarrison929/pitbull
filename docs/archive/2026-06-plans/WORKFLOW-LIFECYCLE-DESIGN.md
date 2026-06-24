# Workflow Lifecycle Engine — Design Specification

> **Status:** Draft
> **Module:** `Pitbull.Core` (engine) + all domain modules (state machines)
> **Author:** River (AI-assisted design)
> **Date:** 2026-02-22
> **Sponsor:** VP of Construction (Tom Reilly), CFO (Michael Chen), VP of Sales (Demo Contact)
> **Executive Review Reference:** "Approval workflows are scattered across modules with no consistency. Need a unified engine."

---

## 1. Purpose & Scope

### 1.1 Problem Statement

Every business object in Pitbull has a lifecycle — RFIs move from Open to Answered to Closed, submittals go through review cycles, pay applications flow through a multi-party approval chain, change orders need authorization before impacting contract values. Today, each module implements its own ad-hoc status transitions with varying levels of validation, audit trail, and notification.

The system already has significant workflow infrastructure:
- `WorkflowTransition` entity recording all status changes
- `IWorkflowTransitionService` called by 6+ services
- `ChangeOrderStatusTransitions` class validating allowed transitions
- `StatusBadge`, `StatusTimeline`, `WorkflowStepper` frontend components
- `AuditLog` entity with 16 action types including `StatusChange`, `Approval`, `Rejection`
- `NotificationType` enum with 18+ workflow-related notification types
- Time entry approval queue page as the pattern for bulk approve workflows

**What's missing:** A unified workflow definition engine that lets administrators define approval chains, set SLA thresholds, configure escalation rules, enable delegation/proxy approval, and get a cross-entity "My Approvals" dashboard — without rebuilding each module's state machine from scratch.

### 1.2 Scope

**Phase 1 (this spec):** Generic workflow definition engine, approval chain configuration, SLA tracking, delegation, escalation, unified approval dashboard. Builds on existing infrastructure.

**Phase 2 (future):** Visual workflow designer (drag-and-drop), conditional branching (amount thresholds, cost code categories), parallel approval gates, external webhook triggers.

### 1.3 Design Philosophy

**Enhance, don't replace.** Every module already has its own status enum and transition logic. The workflow engine adds a layer on top — configurable approval chains, SLA enforcement, delegation — but does not replace the domain-specific transition validation that each module owns. `ChangeOrderStatusTransitions.IsValid()` stays. The workflow engine orchestrates who can approve, when to escalate, and what notifications to send.

### 1.4 Competitive Context

| Feature | Procore | Sage 300 CRE | Vista/Viewpoint | **Pitbull (Phase 1)** |
|---------|---------|--------------|-----------------|----------------------|
| Status tracking | Per-module | Minimal | Per-module | Unified engine |
| Configurable approval chains | Yes (limited) | No | Yes | Yes |
| Delegation/proxy | No | No | Yes | Yes |
| SLA tracking | No | No | No | Yes |
| Escalation rules | No | No | Limited | Yes |
| Bulk approve | Per-module | No | Limited | Cross-entity |
| Audit trail | Yes | Minimal | Yes | Full diff + timeline |
| Mobile approve | Yes | No | App | Yes |

---

## 2. Existing Infrastructure Inventory

### 2.1 Already Built — DO NOT Rebuild

#### Backend

| Component | Location | What It Does |
|-----------|----------|-------------|
| `WorkflowTransition` entity | `Core/Domain/WorkflowTransition.cs` | Records EntityType, EntityId, FromStatus, ToStatus, ChangedByUserId, ChangedByName, ChangedAt, Comment |
| `IWorkflowTransitionService` | `Core/Services/IWorkflowTransitionService.cs` | `RecordTransitionAsync()` — all services already call this |
| `WorkflowTransitionService` | `Api/Features/Workflow/WorkflowTransitionService.cs` | Implementation; validates 6 entity types: TimeEntry, Submittal, RFI, ChangeOrder, PaymentApplication, VendorInvoice |
| `WorkflowTransitionController` | `Api/Controllers/` | `GET api/workflow-transitions/{entityType}/{entityId}` — returns transition history |
| `ChangeOrderStatusTransitions` | `Contracts/Domain/ChangeOrderStatus.cs` | Static allowed-transitions dictionary + `IsValid(from, to)` |
| `AuditLog` entity | `Core/Domain/AuditLog.cs` | Immutable audit with Action enum (StatusChange, Approval, Rejection, etc.) |
| `NotificationType` enum | `Notifications/Domain/Notification.cs` | 18+ types: TimeEntrySubmitted/Approved/Rejected, PendingApproval, ChangeOrder, OverdueRfi, etc. |
| `INotificationService` | `Notifications/Services/` | Full CRUD + unread counts + preferences |
| `NotificationPreference` | `Notifications/Domain/` | Per-user, per-category enable/disable for InApp and Email |
| `DeadlineCheckService` | `Api/Services/DeadlineCheckService.cs` | Background service checking RFI/submittal deadlines on timer |

#### Frontend

| Component | Location | What It Does |
|-----------|----------|-------------|
| `StatusBadge` | `components/ui/status-badge.tsx` | Centralized statusMap with colors for all entity types |
| `StatusTimeline` | `components/ui/status-timeline.tsx` | Fetches transitions, displays vertical timeline |
| `WorkflowStepper` | `components/ui/workflow-stepper.tsx` | Milestone/phase progress display |
| Time entry approval queue | `time-tracking/approval/page.tsx` | Bulk approve/reject with comments — **the pattern for all approval queues** |

### 2.2 Status Enums Across the System

The system has 25+ status enums. The workflow engine must support all of them without requiring each to change.

#### Primary Business Object Lifecycles

```
RFI:                    Open → Answered → Closed
Submittal:              Draft → Submitted → InReview → Approved | ApprovedAsNoted | ReviseAndResubmit | Rejected → Closed
ChangeOrder:            Pending → UnderReview → Approved | Rejected | Withdrawn → Void
PaymentApplication:     Draft → Submitted → Reviewed → Approved → Paid | Rejected → Void
BillingApplication:     Draft → PmReview → PmRejected | ReadyToSubmit → SubmittedToOwner → Disputed | ArchitectCertified → PaymentDue → PartiallyPaid → Paid
TimeEntry:              Draft → Submitted → Approved | Rejected
Subcontract:            Draft → PendingApproval → Issued → Executed → InProgress → Complete → ClosedOut | Terminated | OnHold
PurchaseOrder:          Draft → Approved → PartiallyReceived → Received → Closed
VendorInvoice:          Pending → Matched | PartiallyMatched → Approved → Paid
DailyReport:            Draft → Submitted → Approved → Locked
LienWaiver:             Pending → Sent → Received → Approved | Rejected | Waived | Expired
PunchListItem:          Open → InProgress → ReadyForInspection → Closed | Disputed
```

#### Secondary Lifecycles (Simpler, Less Approval-Critical)

```
Schedule:               Draft → Active → Baselined → Archived
MeetingStatus:          Scheduled → InProgress → Completed → Canceled
TaskStatus:             Open → InProgress → Blocked → Complete → Canceled
NarrativeStatus:        Draft → Submitted → Approved → Published
CommunicationStatus:    Open → FollowUpRequired → Closed
ProgressEntryStatus:    Draft → Submitted → Approved → Rejected
ProjectionStatus:       Draft → Submitted → Approved → Locked
```

---

## 3. New Entity Model

### 3.1 Entity Relationship Diagram

```
WorkflowDefinition 1──* WorkflowApprovalStep
        │
        │ (defines approval chain for entity type + trigger status)
        │
WorkflowApprovalStep 1──* WorkflowApprovalAction (pending approvals)
        │
WorkflowDelegation (proxy approval rules)
        │
WorkflowEscalationRule 1──1 WorkflowDefinition
        │
WorkflowSlaPolicy 1──1 WorkflowDefinition

Existing:
WorkflowTransition (already built — not modified)
AuditLog (already built — not modified)
```

### 3.2 WorkflowDefinition

Configures the approval chain for a specific entity type at a specific trigger point (e.g., "when a ChangeOrder transitions to UnderReview, require PM → VP approval").

```csharp
namespace Pitbull.Core.Domain;

/// <summary>
/// Defines an approval chain for a specific entity type + trigger status.
/// Example: ChangeOrder entering "UnderReview" requires sequential approval
/// by ProjectManager then VPConstruction.
/// </summary>
public class WorkflowDefinition : BaseEntity
{
    /// <summary>Entity type this definition applies to (e.g., "ChangeOrder", "PaymentApplication").</summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>The status that triggers this workflow (e.g., "UnderReview", "Submitted").</summary>
    public string TriggerStatus { get; set; } = string.Empty;

    /// <summary>The status to set when all steps are approved.</summary>
    public string ApprovedStatus { get; set; } = string.Empty;

    /// <summary>The status to set when any step rejects.</summary>
    public string RejectedStatus { get; set; } = string.Empty;

    /// <summary>Human-readable name (e.g., "Change Order Approval > $50K").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional description.</summary>
    public string? Description { get; set; }

    /// <summary>Whether this definition is active.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Optional: only trigger when entity amount exceeds this threshold.</summary>
    public decimal? AmountThreshold { get; set; }

    /// <summary>Approval mode: Sequential (step-by-step) or Parallel (all at once).</summary>
    public ApprovalMode Mode { get; set; } = ApprovalMode.Sequential;

    /// <summary>Priority when multiple definitions match (higher wins).</summary>
    public int Priority { get; set; } = 0;

    /// <summary>ProjectId scope — null means company-wide default.</summary>
    public Guid? ProjectId { get; set; }

    // Navigation
    public List<WorkflowApprovalStep> Steps { get; set; } = [];
    public WorkflowEscalationRule? EscalationRule { get; set; }
    public WorkflowSlaPolicy? SlaPolicy { get; set; }
}

public enum ApprovalMode
{
    Sequential = 0,  // Step 1 must approve before Step 2 sees it
    Parallel = 1     // All steps see it simultaneously, all must approve
}
```

### 3.3 WorkflowApprovalStep

A single step in an approval chain (e.g., "Step 1: Project Manager", "Step 2: VP of Construction").

```csharp
/// <summary>
/// One step in an approval chain. Approvers can be specified by role, by specific user,
/// or by entity relationship (e.g., "the project's assigned PM").
/// </summary>
public class WorkflowApprovalStep : BaseEntity
{
    public Guid WorkflowDefinitionId { get; set; }

    /// <summary>Execution order (1-based). Lower numbers go first in Sequential mode.</summary>
    public int StepOrder { get; set; }

    /// <summary>Human-readable step name (e.g., "Project Manager Review").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>How the approver is determined.</summary>
    public ApproverType ApproverType { get; set; }

    /// <summary>Role name when ApproverType = Role (e.g., "Admin", "ProjectManager").</summary>
    public string? ApproverRole { get; set; }

    /// <summary>Specific user ID when ApproverType = User.</summary>
    public Guid? ApproverUserId { get; set; }

    /// <summary>Entity relationship when ApproverType = EntityRelationship
    /// (e.g., "ProjectManager", "BallInCourtUser", "CreatedBy").</summary>
    public string? ApproverRelationship { get; set; }

    /// <summary>Whether this step can be skipped by the workflow initiator.</summary>
    public bool IsOptional { get; set; } = false;

    /// <summary>Auto-approve after this many hours (0 = never auto-approve).</summary>
    public int AutoApproveAfterHours { get; set; } = 0;

    // Navigation
    public WorkflowDefinition WorkflowDefinition { get; set; } = null!;
}

public enum ApproverType
{
    Role = 0,               // Anyone with the specified role
    User = 1,               // Specific user
    EntityRelationship = 2  // Dynamic: resolved from entity (e.g., project's PM)
}
```

### 3.4 WorkflowApprovalAction

Tracks a pending or completed approval action — the actual record of "PM John approved this change order at 3:15 PM."

```csharp
/// <summary>
/// A concrete approval action for a specific entity instance.
/// Created when an entity enters a trigger status. Resolved when the approver acts.
/// </summary>
public class WorkflowApprovalAction : BaseEntity
{
    public Guid WorkflowDefinitionId { get; set; }
    public Guid WorkflowApprovalStepId { get; set; }

    /// <summary>The entity being approved.</summary>
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }

    /// <summary>The user assigned to approve (resolved from step configuration).</summary>
    public Guid AssignedToUserId { get; set; }
    public string? AssignedToUserName { get; set; }

    /// <summary>Current state of this approval action.</summary>
    public ApprovalActionStatus Status { get; set; } = ApprovalActionStatus.Pending;

    /// <summary>When this action was created (entity entered trigger status).</summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>When the approver acted (null if still pending).</summary>
    public DateTime? ResolvedAtUtc { get; set; }

    /// <summary>Comment from the approver.</summary>
    public string? Comment { get; set; }

    /// <summary>If delegated, the original assignee.</summary>
    public Guid? DelegatedFromUserId { get; set; }
    public string? DelegatedFromUserName { get; set; }

    /// <summary>Step order (denormalized for query performance).</summary>
    public int StepOrder { get; set; }

    /// <summary>Whether this was auto-approved by escalation.</summary>
    public bool IsAutoApproved { get; set; } = false;

    /// <summary>SLA deadline for this action (computed from policy).</summary>
    public DateTime? SlaDeadlineUtc { get; set; }

    // Navigation
    public WorkflowApprovalStep ApprovalStep { get; set; } = null!;
}

public enum ApprovalActionStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Skipped = 3,       // Optional step skipped
    AutoApproved = 4,  // Escalation auto-approved
    Delegated = 5      // Reassigned to delegate
}
```

### 3.5 WorkflowDelegation

Proxy approval rules — "When I'm on vacation, John can approve on my behalf."

```csharp
/// <summary>
/// Delegation rule: allows a delegate to approve on behalf of the delegator
/// for a specific date range and optional entity type scope.
/// </summary>
public class WorkflowDelegation : BaseEntity
{
    /// <summary>The user who is delegating their approval authority.</summary>
    public Guid DelegatorUserId { get; set; }
    public string? DelegatorUserName { get; set; }

    /// <summary>The user receiving delegation.</summary>
    public Guid DelegateUserId { get; set; }
    public string? DelegateUserName { get; set; }

    /// <summary>Delegation start date.</summary>
    public DateTime StartDateUtc { get; set; }

    /// <summary>Delegation end date.</summary>
    public DateTime EndDateUtc { get; set; }

    /// <summary>Optional: limit delegation to specific entity types (null = all).</summary>
    public string? EntityTypeScope { get; set; }

    /// <summary>Optional: limit delegation to specific projects (null = all).</summary>
    public Guid? ProjectIdScope { get; set; }

    /// <summary>Whether this delegation is currently active.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Reason for delegation (e.g., "Vacation 3/1-3/15").</summary>
    public string? Reason { get; set; }
}
```

### 3.6 WorkflowEscalationRule

What happens when an approval sits too long without action.

```csharp
/// <summary>
/// Escalation rules for a workflow definition. Defines what happens when
/// an approval action exceeds its SLA or sits pending too long.
/// </summary>
public class WorkflowEscalationRule : BaseEntity
{
    public Guid WorkflowDefinitionId { get; set; }

    /// <summary>Hours after which the first escalation triggers.</summary>
    public int EscalateAfterHours { get; set; } = 48;

    /// <summary>What to do on escalation.</summary>
    public EscalationType EscalationType { get; set; } = EscalationType.Notify;

    /// <summary>User to notify/reassign to (null = use next step's approver or manager).</summary>
    public Guid? EscalateToUserId { get; set; }

    /// <summary>Role to escalate to (e.g., "Admin", "VPConstruction").</summary>
    public string? EscalateToRole { get; set; }

    /// <summary>Hours between repeated escalation notifications (0 = notify once).</summary>
    public int RepeatIntervalHours { get; set; } = 24;

    /// <summary>Max number of escalation notifications before auto-action.</summary>
    public int MaxEscalations { get; set; } = 3;

    /// <summary>What to do after max escalations exhausted.</summary>
    public EscalationFinalAction FinalAction { get; set; } = EscalationFinalAction.AutoApprove;

    // Navigation
    public WorkflowDefinition WorkflowDefinition { get; set; } = null!;
}

public enum EscalationType
{
    Notify = 0,      // Send notification to escalation target
    Reassign = 1,    // Reassign the approval action to escalation target
    NotifyAndReassign = 2
}

public enum EscalationFinalAction
{
    AutoApprove = 0,   // Auto-approve after max escalations
    AutoReject = 1,    // Auto-reject after max escalations
    Lock = 2           // Lock entity, require manual admin intervention
}
```

### 3.7 WorkflowSlaPolicy

SLA tracking per status — "Change orders should not sit in UnderReview for more than 5 business days."

```csharp
/// <summary>
/// SLA policy for a workflow definition. Tracks how long entities are expected
/// to remain in their trigger status before resolution.
/// </summary>
public class WorkflowSlaPolicy : BaseEntity
{
    public Guid WorkflowDefinitionId { get; set; }

    /// <summary>Target resolution time in business hours.</summary>
    public int TargetBusinessHours { get; set; } = 40; // 5 business days

    /// <summary>Warning threshold in business hours (notify when approaching).</summary>
    public int WarningBusinessHours { get; set; } = 32; // 4 business days

    /// <summary>Whether to count only business hours (M-F, 8-5) or calendar hours.</summary>
    public bool UseBusinessHoursOnly { get; set; } = true;

    /// <summary>Whether SLA breaches create notifications.</summary>
    public bool NotifyOnBreach { get; set; } = true;

    /// <summary>Whether SLA breaches are visible on dashboards.</summary>
    public bool ShowOnDashboard { get; set; } = true;

    // Navigation
    public WorkflowDefinition WorkflowDefinition { get; set; } = null!;
}
```

---

## 4. EF Core Configuration

### 4.1 Table Definitions

```csharp
public class WorkflowDefinitionConfiguration : IEntityTypeConfiguration<WorkflowDefinition>
{
    public void Configure(EntityTypeBuilder<WorkflowDefinition> builder)
    {
        builder.ToTable("workflow_definitions");

        // Unique: one active definition per entity type + trigger status + company (+ optional project)
        builder.HasIndex(x => new { x.TenantId, x.EntityType, x.TriggerStatus, x.ProjectId, x.Priority })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = false AND \"IsActive\" = true");

        builder.Property(x => x.Mode).HasConversion<string>();
        builder.Property(x => x.AmountThreshold).HasPrecision(18, 2);

        builder.HasMany(x => x.Steps)
            .WithOne(s => s.WorkflowDefinition)
            .HasForeignKey(s => s.WorkflowDefinitionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.EscalationRule)
            .WithOne(e => e.WorkflowDefinition)
            .HasForeignKey<WorkflowEscalationRule>(e => e.WorkflowDefinitionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.SlaPolicy)
            .WithOne(s => s.WorkflowDefinition)
            .HasForeignKey<WorkflowSlaPolicy>(s => s.WorkflowDefinitionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.UseXminAsConcurrencyToken();
    }
}

public class WorkflowApprovalStepConfiguration : IEntityTypeConfiguration<WorkflowApprovalStep>
{
    public void Configure(EntityTypeBuilder<WorkflowApprovalStep> builder)
    {
        builder.ToTable("workflow_approval_steps");

        builder.HasIndex(x => new { x.WorkflowDefinitionId, x.StepOrder }).IsUnique();
        builder.Property(x => x.ApproverType).HasConversion<string>();

        builder.UseXminAsConcurrencyToken();
    }
}

public class WorkflowApprovalActionConfiguration : IEntityTypeConfiguration<WorkflowApprovalAction>
{
    public void Configure(EntityTypeBuilder<WorkflowApprovalAction> builder)
    {
        builder.ToTable("workflow_approval_actions");

        // Query: "all pending approvals for a user"
        builder.HasIndex(x => new { x.TenantId, x.AssignedToUserId, x.Status });

        // Query: "all approval actions for an entity"
        builder.HasIndex(x => new { x.TenantId, x.EntityType, x.EntityId });

        // Query: "pending actions past SLA"
        builder.HasIndex(x => new { x.TenantId, x.Status, x.SlaDeadlineUtc })
            .HasFilter("\"Status\" = 'Pending'");

        builder.Property(x => x.Status).HasConversion<string>();

        builder.UseXminAsConcurrencyToken();
    }
}

public class WorkflowDelegationConfiguration : IEntityTypeConfiguration<WorkflowDelegation>
{
    public void Configure(EntityTypeBuilder<WorkflowDelegation> builder)
    {
        builder.ToTable("workflow_delegations");

        builder.HasIndex(x => new { x.TenantId, x.DelegatorUserId, x.IsActive });
        builder.HasIndex(x => new { x.TenantId, x.DelegateUserId, x.IsActive });

        builder.UseXminAsConcurrencyToken();
    }
}

public class WorkflowEscalationRuleConfiguration : IEntityTypeConfiguration<WorkflowEscalationRule>
{
    public void Configure(EntityTypeBuilder<WorkflowEscalationRule> builder)
    {
        builder.ToTable("workflow_escalation_rules");
        builder.Property(x => x.EscalationType).HasConversion<string>();
        builder.Property(x => x.FinalAction).HasConversion<string>();
        builder.UseXminAsConcurrencyToken();
    }
}

public class WorkflowSlaPolicyConfiguration : IEntityTypeConfiguration<WorkflowSlaPolicy>
{
    public void Configure(EntityTypeBuilder<WorkflowSlaPolicy> builder)
    {
        builder.ToTable("workflow_sla_policies");
        builder.UseXminAsConcurrencyToken();
    }
}
```

---

## 5. State Machine Catalog

### 5.1 Complete State Machine Diagrams

Each business object's full state machine, including allowed transitions, approver roles, and notification triggers.

#### 5.1.1 RFI Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RFI Lifecycle                               │
│                                                                     │
│   ┌──────┐    respond    ┌──────────┐    close     ┌────────┐      │
│   │ Open │──────────────▶│ Answered │─────────────▶│ Closed │      │
│   └──────┘               └──────────┘              └────────┘      │
│       │                       │                                     │
│       │      reopen           │        reopen                       │
│       ◀───────────────────────┘◀───────────────────┘               │
│                                                                     │
│   Trigger: RFI created → Open                                      │
│   SLA: 7 calendar days to respond (configurable)                   │
│   Notify: AssignedToUser on create; BallInCourtUser on answer      │
│   Escalation: 48h with no response → notify PM                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Transitions:**
| From | To | Who Can Do It | Side Effects |
|------|----|---------------|-------------|
| Open | Answered | AssignedToUser, Admin | Records response date, notifies creator |
| Open | Closed | PM, Admin | Marks as closed without response (withdrawn) |
| Answered | Closed | Creator, PM, Admin | Final close |
| Answered | Open | Creator, PM | Reopen for follow-up |
| Closed | Open | PM, Admin | Reopen closed RFI |

#### 5.1.2 Submittal Lifecycle

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Submittal Lifecycle                                  │
│                                                                            │
│   ┌───────┐  submit  ┌───────────┐  review  ┌──────────┐                  │
│   │ Draft │─────────▶│ Submitted │─────────▶│ InReview │                  │
│   └───────┘          └───────────┘          └──────────┘                  │
│                                                  │                         │
│                              ┌───────────────────┼───────────────┐         │
│                              ▼                   ▼               ▼         │
│                         ┌──────────┐    ┌──────────────┐  ┌──────────┐    │
│                         │ Approved │    │ApprovedAsNoted│  │ Rejected │    │
│                         └──────────┘    └──────────────┘  └──────────┘    │
│                              │               │               │             │
│                              │               │    ┌──────────────────┐     │
│                              │               │    │ReviseAndResubmit │     │
│                              │               │    └──────────────────┘     │
│                              ▼               ▼               │             │
│                         ┌────────┐                           │             │
│                         │ Closed │◀──────────────────────────┘             │
│                         └────────┘     (after resubmission)               │
│                                                                            │
│   SLA: 14 calendar days from Submitted to resolution                      │
│   Stale warning: 48h in Submitted or InReview (already implemented)       │
│   Ball-in-court tracking: tracks who currently holds the submittal         │
└────────────────────────────────────────────────────────────────────────────┘
```

**Transitions:**
| From | To | Who Can Do It | Side Effects |
|------|----|---------------|-------------|
| Draft | Submitted | Creator, PM | Notifies reviewers, starts SLA clock |
| Submitted | InReview | Reviewer, Architect | Acknowledges receipt |
| InReview | Approved | Reviewer, Architect | Closes submittal, notifies creator |
| InReview | ApprovedAsNoted | Reviewer, Architect | Closes with notes, notifies creator |
| InReview | ReviseAndResubmit | Reviewer, Architect | Returns to creator for revision |
| InReview | Rejected | Reviewer, Architect | Notifies creator with rejection reason |
| ReviseAndResubmit | Submitted | Creator, PM | Resubmission, restarts SLA |
| Any terminal | Closed | PM, Admin | Archive |

#### 5.1.3 Change Order Lifecycle

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Change Order Lifecycle                              │
│                                                                        │
│   ┌─────────┐  review  ┌─────────────┐  approve  ┌──────────┐        │
│   │ Pending │─────────▶│ UnderReview │──────────▶│ Approved │        │
│   └─────────┘          └─────────────┘           └──────────┘        │
│                              │                        │               │
│                    ┌─────────┴─────────┐              │ void          │
│                    ▼                   ▼              ▼               │
│              ┌──────────┐       ┌───────────┐   ┌──────┐            │
│              │ Rejected │       │ Withdrawn │   │ Void │            │
│              └──────────┘       └───────────┘   └──────┘            │
│                                                                      │
│   Amount threshold: COs > $50K require VP approval                  │
│   Approved → updates Subcontract.CurrentValue automatically         │
│   Transition validation: ChangeOrderStatusTransitions.IsValid()     │
└────────────────────────────────────────────────────────────────────────┘
```

**Approval Chain (configurable):**

| Amount | Step 1 | Step 2 | Step 3 |
|--------|--------|--------|--------|
| ≤ $10K | Project Manager | — | — |
| $10K–$50K | Project Manager | Senior PM | — |
| > $50K | Project Manager | Senior PM | VP Construction |

#### 5.1.4 Payment Application Lifecycle (AIA G702/G703)

```
┌────────────────────────────────────────────────────────────────────────────┐
│               Payment Application Lifecycle                                │
│                                                                            │
│   ┌───────┐  submit  ┌───────────┐  review  ┌──────────┐  approve        │
│   │ Draft │─────────▶│ Submitted │─────────▶│ Reviewed │─────────▶       │
│   └───────┘          └───────────┘          └──────────┘                  │
│                              │                    │           ┌──────────┐│
│                              │                    │           │ Approved ││
│                              │              reject│           └──────────┘│
│                              │                    ▼                │       │
│                              │              ┌──────────┐   pay    ▼       │
│                              │              │ Rejected │    ┌──────┐      │
│                              │              └──────────┘    │ Paid │      │
│                              │                              └──────┘      │
│                              │  void                                      │
│                              ▼                                            │
│                         ┌──────┐                                          │
│                         │ Void │                                          │
│                         └──────┘                                          │
│                                                                            │
│   SLA: 30 calendar days from Submitted to Paid (industry standard)        │
│   Involves: Sub submits → PM reviews → Accounting approves → Check cut   │
│   Side effects: Updates BilledToDate on Subcontract SOV lines            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 5.1.5 Billing Application Lifecycle (Owner-Side AIA)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              Billing Application Lifecycle (Owner-Side)                       │
│                                                                              │
│  ┌───────┐  submit  ┌──────────┐  approve  ┌──────────────┐  submit        │
│  │ Draft │────────▶│ PmReview │──────────▶│ReadyToSubmit │──────────▶      │
│  └───────┘         └──────────┘           └──────────────┘                  │
│                         │                         │         ┌─────────────┐ │
│                   reject│                         │         │SubmittedTo  │ │
│                         ▼                         │         │   Owner     │ │
│                  ┌────────────┐                   │         └─────────────┘ │
│                  │ PmRejected │                   │              │          │
│                  └────────────┘                   │     ┌────────┼────────┐ │
│                                                   │     ▼        ▼        │ │
│                                              ┌──────────┐ ┌─────────┐    │ │
│                                              │ Disputed │ │Architect│    │ │
│                                              └──────────┘ │Certified│    │ │
│                                                           └─────────┘    │ │
│                                                                │         │ │
│                                                                ▼         │ │
│                                                         ┌────────────┐   │ │
│                                                         │ PaymentDue │   │ │
│                                                         └────────────┘   │ │
│                                                                │         │ │
│                                                    ┌───────────┼─────┐   │ │
│                                                    ▼               ▼     │ │
│                                             ┌──────────────┐  ┌──────┐   │ │
│                                             │PartiallyPaid │  │ Paid │   │ │
│                                             └──────────────┘  └──────┘   │ │
│                                                                          │ │
│  11-status lifecycle — most complex in the system                        │ │
│  Multi-party: PM → Owner → Architect → Accounting                       │ │
│  SLA: Net 30 from ArchitectCertified to Paid                            │ │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 5.1.6 Time Entry Lifecycle

```
┌───────────────────────────────────────────────────────────────┐
│                   Time Entry Lifecycle                         │
│                                                               │
│   ┌───────┐  submit  ┌───────────┐  approve  ┌──────────┐   │
│   │ Draft │─────────▶│ Submitted │──────────▶│ Approved │   │
│   └───────┘          └───────────┘           └──────────┘   │
│                            │                                  │
│                      reject│                                  │
│                            ▼                                  │
│                      ┌──────────┐                            │
│                      │ Rejected │───────▶ (edit → resubmit)  │
│                      └──────────┘                            │
│                                                               │
│   Bulk approve: Foreman/Super approves entire crew at once   │
│   SLA: Submitted entries should be approved within 24h       │
│   After Approved: flows to payroll processing                │
│   Approved entries are immutable (no further edits)          │
└───────────────────────────────────────────────────────────────┘
```

#### 5.1.7 Subcontract Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      Subcontract Lifecycle                                │
│                                                                          │
│  ┌───────┐  submit  ┌─────────────────┐  issue  ┌────────┐  sign       │
│  │ Draft │────────▶│ PendingApproval │───────▶│ Issued │──────────▶   │
│  └───────┘         └─────────────────┘        └────────┘              │
│                                                    │        ┌──────────┐│
│                                                    │        │ Executed ││
│                                                    │        └──────────┘│
│                                                    │             │       │
│                                                    │   commence  ▼       │
│                                                    │      ┌────────────┐│
│        ┌────────┐    terminate    ┌────────────┐   │      │ InProgress ││
│        │OnHold  │◀──────────────▶│ Terminated │   │      └────────────┘│
│        └────────┘                └────────────┘   │             │       │
│            ▲                                      │   complete  ▼       │
│            │               hold                   │      ┌──────────┐  │
│            └──────────────────────────────────────┘      │ Complete │  │
│                                                          └──────────┘  │
│                                                               │         │
│                                                     close out ▼         │
│                                                          ┌───────────┐ │
│                                                          │ ClosedOut │ │
│                                                          └───────────┘ │
│                                                                        │
│  9-status lifecycle. Approval needed before issuing to sub.            │
│  ClosedOut requires: all COs resolved, retention released,            │
│  final lien waiver received.                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

#### 5.1.8 Purchase Order Lifecycle

```
┌───────────────────────────────────────────────────────────────────────┐
│                    Purchase Order Lifecycle                            │
│                                                                       │
│   ┌───────┐  approve  ┌──────────┐  receive  ┌───────────────────┐   │
│   │ Draft │──────────▶│ Approved │──────────▶│PartiallyReceived │   │
│   └───────┘           └──────────┘           └───────────────────┘   │
│                                                       │               │
│                                              receive  ▼               │
│                                              ┌──────────┐            │
│                                              │ Received │            │
│                                              └──────────┘            │
│                                                   │                   │
│                                             close ▼                   │
│                                              ┌────────┐              │
│                                              │ Closed │              │
│                                              └────────┘              │
│                                                                       │
│   Amount threshold: POs > $25K require PM approval                   │
│   Matched against vendor invoices (2-way or 3-way match)             │
└───────────────────────────────────────────────────────────────────────┘
```

#### 5.1.9 Vendor Invoice Lifecycle

```
┌───────────────────────────────────────────────────────────────────┐
│                   Vendor Invoice Lifecycle                         │
│                                                                   │
│   ┌─────────┐  match  ┌─────────┐  approve  ┌──────────┐        │
│   │ Pending │────────▶│ Matched │──────────▶│ Approved │        │
│   └─────────┘         └─────────┘           └──────────┘        │
│       │                                          │               │
│       │  partial   ┌──────────────────┐    pay   ▼               │
│       └───────────▶│PartiallyMatched │     ┌──────┐             │
│                    └──────────────────┘     │ Paid │             │
│                                            └──────┘             │
│                                                                  │
│   Auto-match: AI-assisted PO matching (existing feature)        │
│   Tolerance: configurable variance % (default 5%)               │
│   3-way match: PO line → receiving → invoice                    │
└───────────────────────────────────────────────────────────────────┘
```

#### 5.1.10 Daily Report Lifecycle

```
┌────────────────────────────────────────────────────────────────┐
│                  Daily Report Lifecycle                          │
│                                                                │
│   ┌───────┐  submit  ┌───────────┐  approve  ┌──────────┐    │
│   │ Draft │─────────▶│ Submitted │──────────▶│ Approved │    │
│   └───────┘          └───────────┘           └──────────┘    │
│                                                    │          │
│                                              lock  ▼          │
│                                              ┌────────┐      │
│                                              │ Locked │      │
│                                              └────────┘      │
│                                                               │
│   Locked: cannot be edited (legal/claims protection)         │
│   Auto-lock: 48h after approval (configurable)               │
│   Photos and weather data attached during Draft               │
└────────────────────────────────────────────────────────────────┘
```

#### 5.1.11 Lien Waiver Lifecycle

```
┌────────────────────────────────────────────────────────────────────┐
│                    Lien Waiver Lifecycle                            │
│                                                                    │
│   ┌─────────┐  send  ┌──────┐  receive  ┌──────────┐             │
│   │ Pending │───────▶│ Sent │──────────▶│ Received │             │
│   └─────────┘        └──────┘           └──────────┘             │
│                                              │                    │
│                              ┌───────────────┼───────────┐        │
│                              ▼               ▼           ▼        │
│                        ┌──────────┐   ┌──────────┐ ┌─────────┐   │
│                        │ Approved │   │ Rejected │ │  Waived │   │
│                        └──────────┘   └──────────┘ └─────────┘   │
│                                                          │        │
│                                                    ┌─────────┐    │
│                                                    │ Expired │    │
│                                                    └─────────┘    │
│                                                                    │
│   Compliance gate: payment cannot be released without approved    │
│   lien waiver. Ties into retention release workflow.              │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Service Layer

### 6.1 IWorkflowEngineService

The core orchestration service — intercepts status transitions and manages approval chains.

```csharp
namespace Pitbull.Core.Services;

public interface IWorkflowEngineService
{
    /// <summary>
    /// Called when a domain service is about to transition an entity's status.
    /// Returns whether the transition should proceed immediately or requires approval.
    /// If approval is required, creates WorkflowApprovalAction records and returns RequiresApproval.
    /// </summary>
    Task<WorkflowTransitionResult> EvaluateTransitionAsync(
        string entityType,
        Guid entityId,
        string fromStatus,
        string toStatus,
        Guid initiatedByUserId,
        decimal? entityAmount = null,
        Guid? projectId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Approve an approval action. If this completes all required steps,
    /// automatically transitions the entity to the approved status.
    /// </summary>
    Task<WorkflowActionResult> ApproveAsync(
        Guid approvalActionId,
        Guid approverUserId,
        string? comment = null,
        CancellationToken ct = default);

    /// <summary>
    /// Reject an approval action. Transitions entity to rejected status.
    /// </summary>
    Task<WorkflowActionResult> RejectAsync(
        Guid approvalActionId,
        Guid approverUserId,
        string? comment = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get all pending approval actions for a user (including delegated).
    /// </summary>
    Task<IReadOnlyList<PendingApprovalDto>> GetPendingApprovalsAsync(
        Guid userId,
        string? entityTypeFilter = null,
        CancellationToken ct = default);

    /// <summary>
    /// Bulk approve multiple actions at once (e.g., all time entries for a crew).
    /// </summary>
    Task<BulkApprovalResult> BulkApproveAsync(
        IReadOnlyList<Guid> approvalActionIds,
        Guid approverUserId,
        string? comment = null,
        CancellationToken ct = default);

    /// <summary>
    /// Bulk reject multiple actions at once.
    /// </summary>
    Task<BulkApprovalResult> BulkRejectAsync(
        IReadOnlyList<Guid> approvalActionIds,
        Guid approverUserId,
        string? comment = null,
        CancellationToken ct = default);

    /// <summary>
    /// Get SLA status for all pending items (for dashboard).
    /// </summary>
    Task<IReadOnlyList<SlaStatusDto>> GetSlaStatusAsync(
        Guid? projectId = null,
        string? entityTypeFilter = null,
        CancellationToken ct = default);
}

public record WorkflowTransitionResult(
    bool RequiresApproval,
    string? WorkflowName,
    IReadOnlyList<Guid>? ApprovalActionIds);

public record WorkflowActionResult(
    bool Success,
    string? Error,
    bool WorkflowComplete,
    string? FinalStatus);

public record BulkApprovalResult(
    int Succeeded,
    int Failed,
    IReadOnlyList<string>? Errors);
```

### 6.2 IWorkflowDelegationService

```csharp
public interface IWorkflowDelegationService
{
    Task<WorkflowDelegation> CreateDelegationAsync(CreateDelegationCommand cmd, CancellationToken ct);
    Task<IReadOnlyList<WorkflowDelegationDto>> GetMyDelegationsAsync(Guid userId, CancellationToken ct);
    Task<IReadOnlyList<WorkflowDelegationDto>> GetDelegationsToMeAsync(Guid userId, CancellationToken ct);
    Task RevokeDelegationAsync(Guid delegationId, CancellationToken ct);

    /// <summary>
    /// Resolves the effective approver: if the assigned user has an active delegation,
    /// returns the delegate. Otherwise returns the original user.
    /// </summary>
    Task<Guid> ResolveEffectiveApproverAsync(Guid assignedUserId, string? entityType, Guid? projectId, CancellationToken ct);
}

public record CreateDelegationCommand(
    Guid DelegateUserId,
    DateTime StartDateUtc,
    DateTime EndDateUtc,
    string? EntityTypeScope,
    Guid? ProjectIdScope,
    string? Reason);

public record WorkflowDelegationDto(
    Guid Id,
    Guid DelegatorUserId,
    string? DelegatorUserName,
    Guid DelegateUserId,
    string? DelegateUserName,
    DateTime StartDateUtc,
    DateTime EndDateUtc,
    string? EntityTypeScope,
    Guid? ProjectIdScope,
    string? Reason,
    bool IsActive);
```

### 6.3 IWorkflowDefinitionService

CRUD for workflow definitions (admin-only).

```csharp
public interface IWorkflowDefinitionService
{
    Task<IReadOnlyList<WorkflowDefinitionDto>> ListAsync(string? entityTypeFilter = null, CancellationToken ct = default);
    Task<WorkflowDefinitionDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<WorkflowDefinitionDto> CreateAsync(CreateWorkflowDefinitionCommand cmd, CancellationToken ct = default);
    Task<WorkflowDefinitionDto> UpdateAsync(Guid id, UpdateWorkflowDefinitionCommand cmd, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Find the matching workflow definition for a given entity type, status, amount, and project.
    /// Returns the highest-priority active definition that matches.
    /// </summary>
    Task<WorkflowDefinition?> FindMatchingDefinitionAsync(
        string entityType,
        string triggerStatus,
        decimal? amount = null,
        Guid? projectId = null,
        CancellationToken ct = default);
}
```

### 6.4 DTOs

```csharp
public record PendingApprovalDto(
    Guid ApprovalActionId,
    string EntityType,
    Guid EntityId,
    string EntityDisplayName,     // e.g., "CO #003 — Add HVAC dampers"
    string WorkflowName,          // e.g., "Change Order Approval > $50K"
    string StepName,              // e.g., "VP Construction Review"
    int StepOrder,
    int TotalSteps,
    DateTime CreatedAtUtc,
    DateTime? SlaDeadlineUtc,
    SlaStatus SlaStatus,          // OnTrack, Warning, Breached
    decimal? EntityAmount,
    Guid? ProjectId,
    string? ProjectName,
    bool IsDelegated,
    string? DelegatedFromUserName);

public record SlaStatusDto(
    string EntityType,
    Guid EntityId,
    string EntityDisplayName,
    string WorkflowName,
    DateTime EnteredStatusAtUtc,
    int TargetBusinessHours,
    int ElapsedBusinessHours,
    SlaStatus Status,
    DateTime? DeadlineUtc);

public enum SlaStatus
{
    OnTrack = 0,
    Warning = 1,
    Breached = 2
}

public record WorkflowDefinitionDto(
    Guid Id,
    string EntityType,
    string TriggerStatus,
    string ApprovedStatus,
    string RejectedStatus,
    string Name,
    string? Description,
    bool IsActive,
    decimal? AmountThreshold,
    string Mode,
    int Priority,
    Guid? ProjectId,
    string? ProjectName,
    IReadOnlyList<WorkflowApprovalStepDto> Steps,
    WorkflowEscalationRuleDto? EscalationRule,
    WorkflowSlaPolicyDto? SlaPolicy);

public record WorkflowApprovalStepDto(
    Guid Id,
    int StepOrder,
    string Name,
    string ApproverType,
    string? ApproverRole,
    Guid? ApproverUserId,
    string? ApproverUserName,
    string? ApproverRelationship,
    bool IsOptional,
    int AutoApproveAfterHours);

public record WorkflowEscalationRuleDto(
    int EscalateAfterHours,
    string EscalationType,
    Guid? EscalateToUserId,
    string? EscalateToRole,
    int RepeatIntervalHours,
    int MaxEscalations,
    string FinalAction);

public record WorkflowSlaPolicyDto(
    int TargetBusinessHours,
    int WarningBusinessHours,
    bool UseBusinessHoursOnly,
    bool NotifyOnBreach,
    bool ShowOnDashboard);

public record CreateWorkflowDefinitionCommand(
    string EntityType,
    string TriggerStatus,
    string ApprovedStatus,
    string RejectedStatus,
    string Name,
    string? Description,
    decimal? AmountThreshold,
    ApprovalMode Mode,
    int Priority,
    Guid? ProjectId,
    IReadOnlyList<CreateApprovalStepCommand> Steps,
    CreateEscalationRuleCommand? EscalationRule,
    CreateSlaPolicyCommand? SlaPolicy);

public record CreateApprovalStepCommand(
    int StepOrder,
    string Name,
    ApproverType ApproverType,
    string? ApproverRole,
    Guid? ApproverUserId,
    string? ApproverRelationship,
    bool IsOptional,
    int AutoApproveAfterHours);

public record CreateEscalationRuleCommand(
    int EscalateAfterHours,
    EscalationType EscalationType,
    Guid? EscalateToUserId,
    string? EscalateToRole,
    int RepeatIntervalHours,
    int MaxEscalations,
    EscalationFinalAction FinalAction);

public record CreateSlaPolicyCommand(
    int TargetBusinessHours,
    int WarningBusinessHours,
    bool UseBusinessHoursOnly,
    bool NotifyOnBreach,
    bool ShowOnDashboard);

public record UpdateWorkflowDefinitionCommand(
    string? Name,
    string? Description,
    bool? IsActive,
    decimal? AmountThreshold,
    ApprovalMode? Mode,
    int? Priority,
    IReadOnlyList<CreateApprovalStepCommand>? Steps,
    CreateEscalationRuleCommand? EscalationRule,
    CreateSlaPolicyCommand? SlaPolicy);
```

---

## 7. Workflow Engine — Core Algorithm

### 7.1 Transition Evaluation Flow

```
Domain Service calls EvaluateTransitionAsync(entityType, entityId, from, to, userId, amount, projectId)
    │
    ├── 1. Find matching WorkflowDefinition (highest priority, active, amount threshold)
    │       └── If none found → return RequiresApproval: false (proceed immediately)
    │
    ├── 2. Check if initiator has permission to skip workflow
    │       └── Admin role → skip (configurable per definition)
    │
    ├── 3. Create WorkflowApprovalAction records for each step
    │       ├── Resolve approver (role → find users with role, relationship → resolve from entity)
    │       ├── Apply delegation (check WorkflowDelegation for active proxy)
    │       ├── Compute SLA deadline from WorkflowSlaPolicy
    │       └── For Sequential: only first step is active; others wait
    │
    ├── 4. Send notifications to step 1 approvers
    │       └── NotificationType.PendingApproval
    │
    └── 5. Return RequiresApproval: true with ApprovalActionIds
```

### 7.2 Approval Processing Flow

```
ApproveAsync(approvalActionId, approverUserId, comment)
    │
    ├── 1. Validate approver is AssignedToUserId (or active delegate)
    │
    ├── 2. Mark action as Approved, set ResolvedAtUtc
    │
    ├── 3. Record WorkflowTransition (existing service)
    │
    ├── 4. Record AuditLog with Action = Approval
    │
    ├── 5. Check if workflow is complete
    │       ├── Sequential: activate next step, notify next approver
    │       ├── Parallel: check if all steps approved
    │       └── All approved → call domain service to finalize status transition
    │
    └── 6. Send notifications
            ├── To initiator: "Step X approved by {approver}"
            └── To next approver (if sequential): "Your approval needed"
```

### 7.3 Escalation Processing (Background Service)

Extends the existing `DeadlineCheckService` pattern.

```
WorkflowEscalationService (IHostedService, runs every 30 minutes)
    │
    ├── 1. Query all Pending WorkflowApprovalActions past SlaDeadlineUtc
    │
    ├── 2. For each, check WorkflowEscalationRule
    │       ├── Count previous escalation notifications
    │       ├── If < MaxEscalations and past EscalateAfterHours:
    │       │       ├── Notify → send escalation notification
    │       │       ├── Reassign → update AssignedToUserId
    │       │       └── NotifyAndReassign → both
    │       └── If ≥ MaxEscalations:
    │               ├── AutoApprove → approve action, mark IsAutoApproved
    │               ├── AutoReject → reject action
    │               └── Lock → create admin notification, freeze entity
    │
    └── 3. Dedup: track escalation notifications via DeadlineNotification pattern
```

---

## 8. Integration with Existing Services

### 8.1 How Domain Services Integrate

The workflow engine is an **optional enhancement**. Services already work without it. When a workflow definition exists, the engine intercepts the transition.

**Pattern — ContractsService example:**

```csharp
// BEFORE (current code, unchanged):
if (!ChangeOrderStatusTransitions.IsValid(oldStatus, newStatus))
    return Result.Failure<ChangeOrderDto>("Invalid transition", "INVALID_STATUS_TRANSITION");

// AFTER (add workflow check before applying transition):
if (!ChangeOrderStatusTransitions.IsValid(oldStatus, newStatus))
    return Result.Failure<ChangeOrderDto>("Invalid transition", "INVALID_STATUS_TRANSITION");

// Check if workflow engine has an approval chain for this transition
if (_workflowEngine is not null)
{
    var result = await _workflowEngine.EvaluateTransitionAsync(
        "ChangeOrder", changeOrder.Id, oldStatus.ToString(), newStatus.ToString(),
        userId, command.Amount, changeOrder.ProjectId, cancellationToken);

    if (result.RequiresApproval)
        return Result.Success(MapToDto(changeOrder),
            message: $"Approval required: {result.WorkflowName}");
}

// Proceed with transition (no workflow, or workflow not configured)
changeOrder.Status = newStatus;
```

**Key principle:** Domain-specific validation (`ChangeOrderStatusTransitions.IsValid`) always runs first. The workflow engine only adds approval gates — it never changes which transitions are structurally valid.

### 8.2 Services Already Calling IWorkflowTransitionService

These services already have the pattern and can integrate with IWorkflowEngineService via the same optional injection:

| Service | Entity Type | Current Pattern |
|---------|------------|----------------|
| `ContractsService` | ChangeOrder, Subcontract | `IWorkflowTransitionService?` optional injection |
| `PaymentApplicationService` | PaymentApplication | `IWorkflowTransitionService?` optional injection |
| `TimeEntryService` | TimeEntry | `IWorkflowTransitionService?` optional injection |
| `RfiService` | RFI | `IWorkflowTransitionService?` optional injection |
| `SubmittalService` | Submittal | `IWorkflowTransitionService?` optional injection |
| `VendorInvoiceService` | VendorInvoice | `IWorkflowTransitionService?` optional injection |

Each of these adds `IWorkflowEngineService?` as a second optional dependency. Zero breaking changes.

---

## 9. API Design

### 9.1 Workflow Definition Management (Admin)

```
GET    /api/admin/workflow-definitions                     List all definitions
GET    /api/admin/workflow-definitions/{id}                Get definition with steps
POST   /api/admin/workflow-definitions                     Create definition + steps
PUT    /api/admin/workflow-definitions/{id}                Update definition
DELETE /api/admin/workflow-definitions/{id}                Soft delete

Policy: Admin.Settings
```

### 9.2 Approval Actions (All Authenticated Users)

```
GET    /api/approvals/pending                              My pending approvals (+ delegated)
GET    /api/approvals/pending?entityType=ChangeOrder       Filtered by entity type
GET    /api/approvals/history                              My past approvals
POST   /api/approvals/{id}/approve                         Approve single action
POST   /api/approvals/{id}/reject                          Reject single action
POST   /api/approvals/bulk-approve                         Bulk approve (body: { ids: [...], comment? })
POST   /api/approvals/bulk-reject                          Bulk reject

Policy: Authenticated (actions are self-scoping — you only see what's assigned to you)
```

### 9.3 Delegation Management

```
GET    /api/approvals/delegations                          My active delegations (to + from)
POST   /api/approvals/delegations                          Create delegation
DELETE /api/approvals/delegations/{id}                     Revoke delegation

Policy: Authenticated
```

### 9.4 SLA Dashboard

```
GET    /api/approvals/sla-status                           All SLA statuses
GET    /api/approvals/sla-status?projectId={id}            Per-project SLA
GET    /api/approvals/sla-summary                          Aggregate: on-track/warning/breached counts

Policy: ProjectManager, Admin
```

### 9.5 Existing Endpoints (Unchanged)

```
GET    /api/workflow-transitions/{entityType}/{entityId}   Transition history (already exists)
```

---

## 10. Controller Design

### 10.1 WorkflowDefinitionController

```csharp
[ApiController]
[Route("api/admin/workflow-definitions")]
[Authorize(Policy = "Admin.Settings")]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Workflow")]
public class WorkflowDefinitionController(IWorkflowDefinitionService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? entityType, CancellationToken ct)
        => Ok(await service.ListAsync(entityType, ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var result = await service.GetAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWorkflowDefinitionCommand cmd, CancellationToken ct)
        => Ok(await service.CreateAsync(cmd, ct));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWorkflowDefinitionCommand cmd, CancellationToken ct)
        => Ok(await service.UpdateAsync(id, cmd, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}
```

### 10.2 ApprovalController

```csharp
[ApiController]
[Route("api/approvals")]
[Authorize]
[EnableRateLimiting("api")]
[Produces("application/json")]
[Tags("Workflow")]
public class ApprovalController(IWorkflowEngineService engine, IWorkflowDelegationService delegations) : ControllerBase
{
    [HttpGet("pending")]
    public async Task<IActionResult> GetPending([FromQuery] string? entityType, CancellationToken ct)
    {
        var userId = GetUserId();
        return Ok(await engine.GetPendingApprovalsAsync(userId, entityType, ct));
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApprovalRequest? request, CancellationToken ct)
    {
        var result = await engine.ApproveAsync(id, GetUserId(), request?.Comment, ct);
        return result.Success ? Ok(result) : BadRequest(new { error = result.Error });
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ApprovalRequest request, CancellationToken ct)
    {
        var result = await engine.RejectAsync(id, GetUserId(), request.Comment, ct);
        return result.Success ? Ok(result) : BadRequest(new { error = result.Error });
    }

    [HttpPost("bulk-approve")]
    public async Task<IActionResult> BulkApprove([FromBody] BulkApprovalRequest request, CancellationToken ct)
        => Ok(await engine.BulkApproveAsync(request.Ids, GetUserId(), request.Comment, ct));

    [HttpPost("bulk-reject")]
    public async Task<IActionResult> BulkReject([FromBody] BulkApprovalRequest request, CancellationToken ct)
        => Ok(await engine.BulkRejectAsync(request.Ids, GetUserId(), request.Comment, ct));

    [HttpGet("sla-status")]
    public async Task<IActionResult> GetSlaStatus([FromQuery] Guid? projectId, [FromQuery] string? entityType, CancellationToken ct)
        => Ok(await engine.GetSlaStatusAsync(projectId, entityType, ct));

    [HttpGet("delegations")]
    public async Task<IActionResult> GetDelegations(CancellationToken ct)
    {
        var userId = GetUserId();
        var mine = await delegations.GetMyDelegationsAsync(userId, ct);
        var toMe = await delegations.GetDelegationsToMeAsync(userId, ct);
        return Ok(new { myDelegations = mine, delegationsToMe = toMe });
    }

    [HttpPost("delegations")]
    public async Task<IActionResult> CreateDelegation([FromBody] CreateDelegationCommand cmd, CancellationToken ct)
        => Ok(await delegations.CreateDelegationAsync(cmd, ct));

    [HttpDelete("delegations/{id:guid}")]
    public async Task<IActionResult> RevokeDelegation(Guid id, CancellationToken ct)
    {
        await delegations.RevokeDelegationAsync(id, ct);
        return NoContent();
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue("sub")!);
}

public record ApprovalRequest(string? Comment);
public record BulkApprovalRequest(IReadOnlyList<Guid> Ids, string? Comment);
```

---

## 11. Frontend Components

### 11.1 Component Hierarchy

```
app/(dashboard)/approvals/
├── page.tsx                     Unified "My Approvals" dashboard
├── pending/page.tsx             Pending approvals list (filterable)
└── history/page.tsx             Past approvals (audit trail)

app/(dashboard)/admin/workflows/
├── page.tsx                     Workflow definitions list
├── new/page.tsx                 Create new definition
└── [id]/page.tsx                Edit definition + steps

components/workflow/
├── approval-queue.tsx           Reusable approval queue table (bulk select)
├── approval-action-dialog.tsx   Approve/reject modal with comment
├── delegation-dialog.tsx        Create delegation form
├── sla-badge.tsx                OnTrack/Warning/Breached indicator
├── workflow-definition-form.tsx Admin form for creating/editing workflows
└── pending-approvals-widget.tsx Dashboard widget for sidebar/home
```

### 11.2 Unified Approval Dashboard — `approvals/page.tsx`

**Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│  My Approvals                                          [Filter ▾]│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐             │
│  │ Pending │ │ Change  │ │  Time   │ │   Pay    │  ...         │
│  │   12    │ │ Orders  │ │ Entries │ │   Apps   │             │
│  │         │ │    3    │ │    5    │ │    4    │             │
│  └─────────┘ └─────────┘ └─────────┘ └──────────┘             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ ☐ │ Type      │ Entity         │ Amount   │ SLA      │ Act ││
│  ├───┼───────────┼────────────────┼──────────┼──────────┼─────┤│
│  │ ☐ │ CO        │ CO #003 - HVAC │ $45,000  │ ⚠ 3d rem│ ✓ ✗││
│  │ ☐ │ TimeEntry │ Week 02/15 x8  │ —        │ ✓ On trk│ ✓ ✗││
│  │ ☐ │ PayApp    │ PayApp #005    │ $123,456 │ 🔴 Overdue│ ✓ ✗││
│  │ ☐ │ Submittal │ Sub #012-A     │ —        │ ✓ On trk│ ✓ ✗││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [Approve Selected (3)]  [Reject Selected]                      │
│                                                                  │
│  ┌─ Delegation ────────────────────────────────────────────────┐│
│  │ Active: John Smith (Feb 28 – Mar 15) for all entity types  ││
│  │ [+ Add Delegation]                                          ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Fetches `GET /api/approvals/pending` on mount
- Filter chips by entity type (Change Orders, Time Entries, Pay Apps, etc.)
- Checkbox multi-select for bulk approve/reject
- SLA badge with color coding (green = on track, yellow = warning, red = breached)
- Click row to expand: shows entity details, workflow timeline, approval history
- Delegation section at bottom

### 11.3 Approval Action Dialog

```
┌─────────────────────────────────┐
│  Approve Change Order #003?     │
│                                 │
│  Amount: $45,000                │
│  Requested by: Jane Smith       │
│  Step: VP Construction Review   │
│  (Step 2 of 2)                  │
│                                 │
│  Comment (optional):            │
│  ┌─────────────────────────────┐│
│  │                             ││
│  └─────────────────────────────┘│
│                                 │
│  [Cancel]  [Reject]  [Approve]  │
└─────────────────────────────────┘
```

### 11.4 SLA Badge Component

Extends existing `StatusBadge` with SLA awareness.

```tsx
// components/workflow/sla-badge.tsx
interface SlaBadgeProps {
  status: "on_track" | "warning" | "breached";
  deadline?: string;      // ISO date
  elapsedHours?: number;
  targetHours?: number;
}

// Colors:
// on_track:  green background, "On Track" or "2d remaining"
// warning:   yellow/amber, "Warning: 8h remaining"
// breached:  red, "Overdue by 2 days"
```

### 11.5 Pending Approvals Widget (Dashboard Sidebar)

A compact widget for the main dashboard showing approval counts and urgent items.

```
┌─ Pending Approvals ──────────┐
│                               │
│  12 items awaiting review     │
│                               │
│  🔴 3 past SLA deadline       │
│  ⚠️ 2 approaching deadline    │
│                               │
│  Most urgent:                 │
│  • CO #003 ($45K) - 2d overdue│
│  • PayApp #005 - 1d overdue   │
│                               │
│  [View All →]                 │
└───────────────────────────────┘
```

### 11.6 Admin Workflow Definition Page

```
┌──────────────────────────────────────────────────────────────────┐
│  Workflow Definitions                              [+ New Workflow]│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Entity Type: [All ▾]                                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Name                    │ Entity   │ Trigger   │ Steps│ Act ││
│  ├─────────────────────────┼──────────┼───────────┼──────┼─────┤│
│  │ CO Approval > $50K      │ CO       │ UnderRev  │  3   │ ✓  ││
│  │ CO Approval ≤ $50K      │ CO       │ UnderRev  │  1   │ ✓  ││
│  │ Pay App Review          │ PayApp   │ Submitted │  2   │ ✓  ││
│  │ Time Entry Approval     │ TimeEntry│ Submitted │  1   │ ✓  ││
│  │ PO Approval > $25K      │ PO       │ Draft     │  2   │ ✓  ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 11.7 Existing Components (Enhanced, Not Replaced)

| Component | Enhancement |
|-----------|------------|
| `StatusBadge` | Add SLA indicator dot (green/yellow/red) when workflow is active |
| `StatusTimeline` | Add approval actions to timeline (who approved at which step) |
| `WorkflowStepper` | Show approval chain progress (Step 1: PM ✓ → Step 2: VP ⏳) |

---

## 12. Background Services

### 12.1 WorkflowEscalationService

Extends the `DeadlineCheckService` pattern — runs on a periodic timer.

```csharp
public class WorkflowEscalationService(
    IServiceScopeFactory scopeFactory,
    IOptions<WorkflowEscalationOptions> options,
    ILogger<WorkflowEscalationService> logger) : IHostedService, IDisposable
{
    // Runs every 30 minutes (configurable)
    // 1. Query pending WorkflowApprovalActions past SlaDeadlineUtc
    // 2. Apply escalation rules per WorkflowEscalationRule
    // 3. Send escalation notifications
    // 4. Apply final actions (auto-approve/reject/lock) after max escalations
    // 5. Dedup via DeadlineNotification pattern
}

public class WorkflowEscalationOptions
{
    public const string SectionName = "WorkflowEscalation";
    public double IntervalMinutes { get; set; } = 30;
}
```

### 12.2 DelegationExpiryService

Auto-deactivates expired delegations.

```csharp
// Lightweight service running daily
// Queries active WorkflowDelegations where EndDateUtc < now
// Sets IsActive = false
// Logs deactivation
```

---

## 13. Notification Integration

### 13.1 New NotificationType Values

```csharp
// Add to existing NotificationType enum:
ApprovalRequested,       // "Your approval is needed for CO #003"
ApprovalCompleted,       // "CO #003 has been approved"
ApprovalRejected,        // "CO #003 has been rejected"
ApprovalEscalated,       // "CO #003 approval escalated — past SLA"
ApprovalDelegated,       // "CO #003 approval delegated to John Smith"
SlaWarning,              // "CO #003 approaching SLA deadline (8h remaining)"
SlaBreach,               // "CO #003 has breached SLA (overdue by 2 days)"
WorkflowAutoApproved,    // "CO #003 auto-approved after escalation"
DelegationCreated,       // "John delegated approvals to you (Mar 1–15)"
DelegationExpired        // "Your delegation to John has expired"
```

### 13.2 Notification Preference Categories

```csharp
// New categories for INotificationPreferenceService:
"approval_requested"       // When I'm assigned as approver
"approval_completed"       // When workflows I initiated are resolved
"approval_escalated"       // When my approvals are escalated
"sla_warning"             // When items are approaching SLA
"sla_breach"              // When items breach SLA
"delegation_activity"     // Delegation create/expire
```

---

## 14. Default Workflow Definitions (Seed Data)

Pre-configured workflows that admins can customize. Created during tenant onboarding.

### 14.1 Change Order Approval

```json
{
  "entityType": "ChangeOrder",
  "triggerStatus": "UnderReview",
  "approvedStatus": "Approved",
  "rejectedStatus": "Rejected",
  "name": "Change Order Approval (Standard)",
  "amountThreshold": null,
  "mode": "Sequential",
  "priority": 0,
  "steps": [
    { "stepOrder": 1, "name": "Project Manager Review", "approverType": "EntityRelationship", "approverRelationship": "ProjectManager" }
  ],
  "escalationRule": { "escalateAfterHours": 48, "escalationType": "Notify", "escalateToRole": "Admin", "maxEscalations": 3, "finalAction": "AutoApprove" },
  "slaPolicy": { "targetBusinessHours": 40, "warningBusinessHours": 32 }
}
```

### 14.2 Change Order Approval (High Value)

```json
{
  "entityType": "ChangeOrder",
  "triggerStatus": "UnderReview",
  "approvedStatus": "Approved",
  "rejectedStatus": "Rejected",
  "name": "Change Order Approval > $50K",
  "amountThreshold": 50000,
  "mode": "Sequential",
  "priority": 10,
  "steps": [
    { "stepOrder": 1, "name": "Project Manager Review", "approverType": "EntityRelationship", "approverRelationship": "ProjectManager" },
    { "stepOrder": 2, "name": "Senior PM Review", "approverType": "Role", "approverRole": "SeniorProjectManager" },
    { "stepOrder": 3, "name": "VP Construction Approval", "approverType": "Role", "approverRole": "VPConstruction" }
  ],
  "escalationRule": { "escalateAfterHours": 72, "escalationType": "NotifyAndReassign", "escalateToRole": "Admin", "maxEscalations": 5, "finalAction": "Lock" },
  "slaPolicy": { "targetBusinessHours": 80, "warningBusinessHours": 64 }
}
```

### 14.3 Time Entry Approval

```json
{
  "entityType": "TimeEntry",
  "triggerStatus": "Submitted",
  "approvedStatus": "Approved",
  "rejectedStatus": "Rejected",
  "name": "Time Entry Approval",
  "mode": "Sequential",
  "priority": 0,
  "steps": [
    { "stepOrder": 1, "name": "Supervisor Approval", "approverType": "Role", "approverRole": "Supervisor", "autoApproveAfterHours": 72 }
  ],
  "escalationRule": { "escalateAfterHours": 24, "escalationType": "Notify", "escalateToRole": "ProjectManager", "maxEscalations": 2, "finalAction": "AutoApprove" },
  "slaPolicy": { "targetBusinessHours": 8, "warningBusinessHours": 6 }
}
```

### 14.4 Payment Application Approval

```json
{
  "entityType": "PaymentApplication",
  "triggerStatus": "Submitted",
  "approvedStatus": "Reviewed",
  "rejectedStatus": "Rejected",
  "name": "Payment Application Review",
  "mode": "Sequential",
  "priority": 0,
  "steps": [
    { "stepOrder": 1, "name": "Project Manager Review", "approverType": "EntityRelationship", "approverRelationship": "ProjectManager" },
    { "stepOrder": 2, "name": "Accounting Approval", "approverType": "Role", "approverRole": "Accountant" }
  ],
  "slaPolicy": { "targetBusinessHours": 40, "warningBusinessHours": 32 }
}
```

### 14.5 Purchase Order Approval (High Value)

```json
{
  "entityType": "PurchaseOrder",
  "triggerStatus": "Draft",
  "approvedStatus": "Approved",
  "rejectedStatus": "Draft",
  "name": "PO Approval > $25K",
  "amountThreshold": 25000,
  "mode": "Sequential",
  "priority": 10,
  "steps": [
    { "stepOrder": 1, "name": "Project Manager Approval", "approverType": "EntityRelationship", "approverRelationship": "ProjectManager" },
    { "stepOrder": 2, "name": "VP Approval", "approverType": "Role", "approverRole": "VPConstruction" }
  ],
  "slaPolicy": { "targetBusinessHours": 16, "warningBusinessHours": 12 }
}
```

---

## 15. Construction Domain Considerations

### 15.1 Multi-Party Approval Chains

Construction projects involve multiple external parties. Approval chains must reflect this:

| Scenario | Parties Involved | Flow |
|----------|-----------------|------|
| Sub pay app | Sub → PM → Accountant → Check | 3 internal approvers |
| Owner billing | PM → Owner → Architect → Accountant | 2 internal + 2 external |
| Change order | Sub proposes → PM evaluates → VP approves | 1 external + 2 internal |
| Submittal | Sub submits → PM reviews → Architect decides | 1 external + 1 internal + 1 external |

**External party limitation (Phase 1):** The workflow engine handles internal approvers only. External party actions (owner approval, architect certification) are recorded as manual status changes by internal users. Phase 2 adds portal-based external approvals.

### 15.2 Project-Level Overrides

Different projects may need different approval thresholds. A $200M hospital project needs tighter controls than a $5M tenant improvement.

**Resolution order:**
1. Project-specific definition (highest priority) — `ProjectId IS NOT NULL AND matches`
2. Company-wide definition — `ProjectId IS NULL`
3. No definition — no workflow (pass-through)

### 15.3 End-of-Month Billing Crunch

Construction billing is cyclical — most pay applications are submitted in the last week of the month. The workflow engine must handle:
- Burst of 20-50 pay apps submitted within 48 hours
- Bulk approve capability (PM approves all their project pay apps at once)
- SLA tracking that accounts for billing deadlines (not just calendar time)
- Dashboard widget showing "12 pay apps due by month-end"

### 15.4 Davis-Bacon Compliance

For government projects, time entries require additional approval:
- Certified payroll officer must review before submission
- Prevailing wage rates must be verified
- This is handled by configuring a custom workflow definition for time entries on public works projects

---

## 16. Test Plan

### 16.1 Unit Tests — WorkflowEngineService

| Test | Scenario | Expected |
|------|----------|----------|
| `EvaluateTransition_NoDefinition_ReturnsNoApproval` | No matching workflow definition | `RequiresApproval: false` |
| `EvaluateTransition_MatchingDefinition_CreatesActions` | Matching definition with 2 steps | Creates 2 approval actions |
| `EvaluateTransition_AmountBelowThreshold_SkipsHighValueWorkflow` | CO for $20K, threshold $50K | Uses lower-priority definition |
| `EvaluateTransition_AmountAboveThreshold_UsesHighValueWorkflow` | CO for $75K, threshold $50K | Uses high-value definition |
| `EvaluateTransition_ProjectSpecific_TakesPriority` | Project-specific + company-wide both exist | Uses project-specific |
| `Approve_ValidApprover_MarksApproved` | Correct user approves | Status → Approved, ResolvedAtUtc set |
| `Approve_WrongUser_Fails` | Different user tries to approve | Returns error |
| `Approve_DelegateUser_Succeeds` | Delegate approves | Marked approved with DelegatedFromUserId |
| `Approve_SequentialStep1_ActivatesStep2` | Step 1 approved in sequential mode | Step 2 notifications sent |
| `Approve_AllStepsComplete_TransitionsEntity` | Final step approved | WorkflowComplete: true, FinalStatus set |
| `Reject_AnyStep_TransitionsToRejected` | Step 2 of 3 rejects | Entity → RejectedStatus |
| `BulkApprove_MultipleActions_AllSucceed` | 5 time entry approvals | Succeeded: 5, Failed: 0 |
| `BulkApprove_MixedValidity_PartialSuccess` | 3 valid + 1 already resolved | Succeeded: 3, Failed: 1 |
| `GetPending_IncludesDelegated` | User has 2 own + 1 delegated | Returns 3 items |
| `GetPending_ExcludesInactiveDelegation` | Delegation expired | Excludes delegated items |

### 16.2 Unit Tests — WorkflowDelegationService

| Test | Scenario | Expected |
|------|----------|----------|
| `CreateDelegation_ValidDates_Succeeds` | Start < End, delegate exists | Creates delegation |
| `CreateDelegation_EndBeforeStart_Fails` | EndDate < StartDate | Validation error |
| `CreateDelegation_SelfDelegation_Fails` | Delegator = Delegate | Validation error |
| `ResolveApprover_ActiveDelegation_ReturnsDelegate` | User has active delegation | Returns delegate ID |
| `ResolveApprover_ExpiredDelegation_ReturnsOriginal` | Delegation past EndDate | Returns original user |
| `ResolveApprover_ScopedDelegation_Matches` | Delegation scoped to ChangeOrder | Returns delegate for CO |
| `ResolveApprover_ScopedDelegation_NoMatch` | Delegation scoped to CO, checking TimeEntry | Returns original |
| `RevokeDelegation_Active_SetsInactive` | Active delegation | IsActive → false |

### 16.3 Unit Tests — WorkflowDefinitionService

| Test | Scenario | Expected |
|------|----------|----------|
| `Create_ValidDefinition_Succeeds` | All required fields | Creates with steps |
| `Create_DuplicateEntityTypeTrigger_Fails` | Same EntityType + TriggerStatus + Priority | Unique constraint error |
| `FindMatching_HigherPriority_Wins` | Two definitions, different priorities | Returns higher priority |
| `FindMatching_ProjectSpecific_Wins` | Project-specific + company-wide | Returns project-specific |
| `FindMatching_AmountThreshold_Filters` | Amount below threshold | Skips threshold definition |
| `Update_DeactivateDefinition_Succeeds` | Set IsActive = false | Definition deactivated |
| `Delete_SoftDeletes` | Delete existing | IsDeleted = true |

### 16.4 Integration Tests

| Test | Scenario |
|------|----------|
| End-to-end CO approval | Create CO → transition to UnderReview → PM approves → VP approves → status = Approved |
| Delegation flow | Create delegation → submit CO → delegate sees pending → delegate approves → recorded with delegation info |
| Escalation | Submit CO → wait past SLA → escalation service runs → notification created |
| Bulk time entry approval | Submit 10 time entries → supervisor bulk approves → all transition to Approved |

---

## 17. Migration Plan

### 17.1 New Tables

```sql
-- 6 new tables
CREATE TABLE workflow_definitions (...);
CREATE TABLE workflow_approval_steps (...);
CREATE TABLE workflow_approval_actions (...);
CREATE TABLE workflow_delegations (...);
CREATE TABLE workflow_escalation_rules (...);
CREATE TABLE workflow_sla_policies (...);
```

### 17.2 Migration Command

```bash
cd src/Pitbull.Api
dotnet ef migrations add AddWorkflowEngine
```

### 17.3 Rollback Safety

All new tables — no existing tables modified. Rollback = drop tables. Zero risk to existing data.

---

## 18. Implementation Phases

### Phase 1a — Core Engine (Week 1)

1. Entities + EF configurations (6 entities)
2. Migration
3. `IWorkflowDefinitionService` + implementation (CRUD)
4. `IWorkflowEngineService` + implementation (evaluate, approve, reject, bulk)
5. `IWorkflowDelegationService` + implementation
6. Controllers (WorkflowDefinitionController, ApprovalController)
7. DI registration in Program.cs
8. Unit tests (30+ tests)

### Phase 1b — Background Services (Week 2)

9. `WorkflowEscalationService` (background timer)
10. `DelegationExpiryService` (daily cleanup)
11. New NotificationType values
12. Integration with 6 existing services (optional `IWorkflowEngineService?` injection)
13. Seed data (default workflow definitions)

### Phase 1c — Frontend (Week 2-3)

14. Unified approval dashboard (`/approvals` page)
15. Approval action dialog component
16. Delegation management UI
17. SLA badge component
18. Pending approvals widget (dashboard sidebar)
19. Admin workflow definitions page
20. Enhance StatusTimeline to show approval steps

### Phase 1d — Polish (Week 3)

21. Frontend build verification (`npx next build`)
22. Backend build verification (`dotnet build` — 0 warnings)
23. Full test suite pass
24. Seed data migration for default workflows

---

## 19. Competitive Differentiation

### 19.1 vs. Procore

Procore has per-module approval workflows but no unified engine. Users must configure approvals separately for each module. No SLA tracking, no delegation, no escalation.

**Pitbull advantage:** One engine governs all entity types. Configure once, enforce everywhere. Cross-entity approval dashboard. SLA tracking with escalation.

### 19.2 vs. Vista/Viewpoint

Vista has strong AP approval workflows but limited PM workflow support. Delegation exists but is clunky (admin-only configuration). No SLA tracking.

**Pitbull advantage:** Modern UI, mobile-friendly bulk approve, real-time SLA dashboard, self-service delegation.

### 19.3 vs. Sage 300 CRE

Sage has minimal workflow support. Most approvals are handled outside the system (email, paper).

**Pitbull advantage:** Full digital workflow with audit trail, notifications, escalation. Eliminates paper-based approval routing.

### 19.4 Unique to Pitbull

- **Amount-based routing:** Different approval chains for different dollar values — automatically selects the right chain
- **Entity relationship resolution:** "Approve by the project's assigned PM" without hardcoding user IDs
- **SLA with escalation cascade:** Warning → Notify manager → Reassign → Auto-approve (configurable per workflow)
- **Delegation with scope:** Delegate approvals for specific entity types or projects, not all-or-nothing
- **Unified dashboard:** One page to see and act on all pending approvals across every module

---

*Addresses Executive Review concerns around approval workflow consistency, audit trail completeness, and delegation support across all modules.*
