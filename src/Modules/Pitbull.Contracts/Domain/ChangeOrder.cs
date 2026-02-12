using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

/// <summary>
/// Change order modifying a subcontract's scope and/or value.
/// Requires approval workflow before impacting contract value.
/// </summary>
public class ChangeOrder : BaseEntity
{
    public Guid SubcontractId { get; set; }
    public string ChangeOrderNumber { get; set; } = string.Empty; // e.g. "CO-001"

    // Description
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Reason { get; set; } // Owner request, field condition, design change, etc.

    // Financial impact
    public decimal Amount { get; set; } // Can be positive (add) or negative (deduct)
    public int? DaysExtension { get; set; } // Schedule impact

    // Status
    public ChangeOrderStatus Status { get; set; } = ChangeOrderStatus.Pending;

    // Dates
    public DateTime? SubmittedDate { get; set; }
    public DateTime? ApprovedDate { get; set; }
    public DateTime? RejectedDate { get; set; }

    // Approval
    public string? ApprovedBy { get; set; }
    public string? RejectedBy { get; set; }
    public string? RejectionReason { get; set; }

    // Reference
    public string? ReferenceNumber { get; set; } // Owner's CO number if applicable

    // Navigation
    public Subcontract? Subcontract { get; set; }
}
