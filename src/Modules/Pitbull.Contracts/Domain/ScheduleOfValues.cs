using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

public enum SOVStatus
{
    Draft = 0,
    Active = 1,
    Closed = 2
}

public class ScheduleOfValues : BaseEntity
{
    public Guid SubcontractId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal TotalScheduledValue { get; set; }
    public SOVStatus Status { get; set; } = SOVStatus.Draft;
    public decimal RetainagePercent { get; set; } = 10m;

    // Navigation
    public Subcontract Subcontract { get; set; } = null!;
    public ICollection<SOVLineItem> LineItems { get; set; } = [];
}
