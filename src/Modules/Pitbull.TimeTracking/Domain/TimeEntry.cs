using Pitbull.Core.Domain;
using Pitbull.Projects.Domain;

namespace Pitbull.TimeTracking.Domain;

/// <summary>
/// Represents a daily time entry for an employee working on a specific project and cost code.
/// This is the core entity for tracking labor hours that will be used for job costing.
/// </summary>
public class TimeEntry : BaseEntity
{
    /// <summary>
    /// The date this time entry applies to (date only, no time component)
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// Employee who performed the work
    /// </summary>
    public Guid EmployeeId { get; set; }

    /// <summary>
    /// Project the work was performed on
    /// </summary>
    public Guid ProjectId { get; set; }

    /// <summary>
    /// Specific cost code for the type of work performed
    /// </summary>
    public Guid CostCodeId { get; set; }

    /// <summary>
    /// Number of regular hours worked (8 hours = normal day)
    /// </summary>
    public decimal RegularHours { get; set; }

    /// <summary>
    /// Number of overtime hours worked (typically 1.5x pay rate)
    /// </summary>
    public decimal OvertimeHours { get; set; }

    /// <summary>
    /// Number of double-time hours worked (typically 2.0x pay rate, weekends/holidays)
    /// </summary>
    public decimal DoubletimeHours { get; set; }

    /// <summary>
    /// Total hours for this entry (calculated property)
    /// </summary>
    public decimal TotalHours => RegularHours + OvertimeHours + DoubletimeHours;

    /// <summary>
    /// Description of work performed (optional, for detailed records)
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Current approval status of this time entry
    /// </summary>
    public TimeEntryStatus Status { get; set; } = TimeEntryStatus.Submitted;

    /// <summary>
    /// Who approved this time entry (if approved)
    /// </summary>
    public Guid? ApprovedById { get; set; }

    /// <summary>
    /// When this time entry was approved (if approved)
    /// </summary>
    public DateTime? ApprovedAt { get; set; }

    /// <summary>
    /// Comments from approver (if any)
    /// </summary>
    public string? ApprovalComments { get; set; }

    /// <summary>
    /// Rejection reason (if rejected)
    /// </summary>
    public string? RejectionReason { get; set; }

    // Navigation properties
    public Employee Employee { get; set; } = null!;
    public Project Project { get; set; } = null!;
    public CostCode CostCode { get; set; } = null!;
    public Employee? ApprovedBy { get; set; }
}

/// <summary>
/// Status workflow for time entries
/// </summary>
public enum TimeEntryStatus
{
    /// <summary>
    /// Time entry has been submitted by employee but not yet reviewed
    /// </summary>
    Submitted = 0,

    /// <summary>
    /// Time entry has been approved by supervisor/foreman
    /// </summary>
    Approved = 1,

    /// <summary>
    /// Time entry has been rejected and needs to be corrected
    /// </summary>
    Rejected = 2,

    /// <summary>
    /// Draft time entry, not yet submitted (allows employee to save progress)
    /// </summary>
    Draft = 3
}