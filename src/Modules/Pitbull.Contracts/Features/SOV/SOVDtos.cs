using Pitbull.Contracts.Domain;

namespace Pitbull.Contracts.Features.SOV;

public record SOVDto(
    Guid Id,
    Guid SubcontractId,
    string Name,
    decimal TotalScheduledValue,
    SOVStatus Status,
    decimal RetainagePercent,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    List<SOVLineItemDto> LineItems
);

public record SOVLineItemDto(
    Guid Id,
    Guid ScheduleOfValuesId,
    string ItemNumber,
    string Description,
    decimal ScheduledValue,
    decimal PreviouslyBilled,
    decimal CurrentBilled,
    decimal StoredMaterials,
    decimal TotalCompletedToDate,
    decimal PercentComplete,
    decimal BalanceToFinish,
    decimal Retainage,
    int SortOrder
);

public record SOVSummaryDto(
    Guid Id,
    string Name,
    decimal TotalScheduledValue,
    decimal TotalPreviouslyBilled,
    decimal TotalCurrentBilled,
    decimal TotalStoredMaterials,
    decimal TotalCompletedToDate,
    decimal OverallPercentComplete,
    decimal TotalBalanceToFinish,
    decimal TotalRetainage,
    int LineItemCount
);

public record CreateSOVCommand(
    string Name,
    decimal RetainagePercent = 10m
);

public record CreateSOVLineItemCommand(
    string ItemNumber,
    string Description,
    decimal ScheduledValue,
    decimal PreviouslyBilled = 0,
    decimal CurrentBilled = 0,
    decimal StoredMaterials = 0,
    decimal Retainage = 0,
    int? SortOrder = null
);

public record UpdateSOVLineItemCommand(
    string? ItemNumber = null,
    string? Description = null,
    decimal? ScheduledValue = null,
    decimal? PreviouslyBilled = null,
    decimal? CurrentBilled = null,
    decimal? StoredMaterials = null,
    decimal? Retainage = null,
    int? SortOrder = null
);

public record ReorderSOVLineItemsCommand(
    List<Guid> LineItemIds
);
