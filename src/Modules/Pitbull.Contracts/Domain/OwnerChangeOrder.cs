using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

/// <summary>
/// Change order modifying an owner contract's scope and/or value.
/// Requires approval workflow before impacting project contract value.
/// </summary>
public class OwnerChangeOrder : BaseEntity, ICompanyScoped
{
    public Guid CompanyId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid? OwnerContractId { get; set; }
    public string ChangeOrderNumber { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Reason { get; set; }

    public decimal Amount { get; set; }
    public int? DaysExtension { get; set; }

    public ChangeOrderStatus Status { get; set; } = ChangeOrderStatus.Pending;

    public DateTime? SubmittedDate { get; set; }
    public DateTime? ApprovedDate { get; set; }
    public DateTime? RejectedDate { get; set; }

    public string? ApprovedBy { get; set; }
    public string? RejectedBy { get; set; }
    public string? RejectionReason { get; set; }

    public string? ReferenceNumber { get; set; }

    public Guid? OriginatingRfiId { get; set; }

    public int? DelayDays { get; set; }
    public decimal? DelayCost { get; set; }
    public string? DelayDescription { get; set; }
}