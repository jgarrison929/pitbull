using Pitbull.Core.Domain;

namespace Pitbull.Contracts.Domain;

public class SOVLineItem : BaseEntity
{
    public Guid ScheduleOfValuesId { get; set; }
    public string ItemNumber { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal ScheduledValue { get; set; }
    public decimal PreviouslyBilled { get; set; }
    public decimal CurrentBilled { get; set; }
    public decimal StoredMaterials { get; set; }
    public decimal Retainage { get; set; }
    public int SortOrder { get; set; }

    // Computed
    public decimal TotalCompletedToDate => PreviouslyBilled + CurrentBilled + StoredMaterials;
    public decimal PercentComplete => ScheduledValue != 0 ? Math.Round(TotalCompletedToDate / ScheduledValue * 100, 2) : 0;
    public decimal BalanceToFinish => ScheduledValue - TotalCompletedToDate;

    // Navigation
    public ScheduleOfValues ScheduleOfValues { get; set; } = null!;
}
