using Pitbull.Core.CQRS;
using Pitbull.Core.Domain;

namespace Pitbull.Billing.Features.AiaBilling;

// ── Owner Contract DTOs ──

public record OwnerContractDto(
    Guid Id,
    Guid ProjectId,
    string ContractNumber,
    string ProjectName,
    string? OwnerName,
    string? ArchitectName,
    decimal OriginalContractSum,
    decimal ApprovedChangeOrderAmount,
    decimal ContractSumToDate,
    decimal DefaultRetainagePercent,
    decimal RetainagePercentMaterials,
    DateOnly? ContractDate,
    int PaymentTermsDays,
    OwnerContractStatus Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateOwnerContractCommand(
    Guid ProjectId,
    string ContractNumber,
    string ProjectName,
    decimal OriginalContractSum,
    string? OwnerName = null,
    string? OwnerAddress = null,
    string? ArchitectName = null,
    string? ArchitectProjectNumber = null,
    decimal DefaultRetainagePercent = 10m,
    decimal RetainagePercentMaterials = 10m,
    DateOnly? ContractDate = null,
    int PaymentTermsDays = 30
) : ICommand<OwnerContractDto>;

public record UpdateOwnerContractCommand(
    Guid ContractId,
    string? ContractNumber = null,
    string? ProjectName = null,
    string? OwnerName = null,
    string? OwnerAddress = null,
    string? ArchitectName = null,
    decimal? OriginalContractSum = null,
    decimal? DefaultRetainagePercent = null,
    decimal? RetainagePercentMaterials = null,
    DateOnly? ContractDate = null,
    int? PaymentTermsDays = null
) : ICommand<OwnerContractDto>;

public record ListOwnerContractsQuery(
    Guid? ProjectId = null,
    OwnerContractStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListOwnerContractsResult>;

public record ListOwnerContractsResult(
    IReadOnlyList<OwnerContractDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

// ── Owner SOV DTOs ──

public record OwnerSOVDto(
    Guid Id,
    Guid ProjectId,
    Guid OwnerContractId,
    string Name,
    decimal OriginalContractAmount,
    decimal ApprovedChangeOrderAmount,
    decimal RevisedContractAmount,
    decimal TotalScheduledValue,
    decimal DefaultRetainagePercent,
    OwnerSOVStatus Status,
    DateTime? LockedDate,
    string? Notes,
    DateTime CreatedAt,
    IReadOnlyList<OwnerSOVLineItemDto>? LineItems
);

public record OwnerSOVLineItemDto(
    Guid Id,
    string ItemNumber,
    string Description,
    int SortOrder,
    decimal OriginalValue,
    decimal ApprovedChangeOrderValue,
    decimal ScheduledValue,
    decimal? RetainagePercent,
    Guid? CostCodeId,
    bool IsFromChangeOrder,
    string? Notes
);

public record CreateOwnerSOVCommand(
    Guid OwnerContractId,
    Guid ProjectId,
    string Name = "Main SOV"
) : ICommand<OwnerSOVDto>;

public record AddSOVLineItemCommand(
    Guid OwnerSOVId,
    string ItemNumber,
    string Description,
    decimal ScheduledValue,
    int SortOrder = 0,
    decimal? RetainagePercent = null,
    Guid? CostCodeId = null,
    string? Notes = null
) : ICommand<OwnerSOVLineItemDto>;

public record UpdateSOVLineItemCommand(
    Guid LineItemId,
    string? ItemNumber = null,
    string? Description = null,
    decimal? ScheduledValue = null,
    int? SortOrder = null,
    decimal? RetainagePercent = null,
    string? Notes = null
) : ICommand<OwnerSOVLineItemDto>;

// ── Billing Application DTOs ──

public record BillingApplicationDto(
    Guid Id,
    Guid ProjectId,
    Guid OwnerContractId,
    Guid OwnerScheduleOfValuesId,
    int ApplicationNumber,
    DateOnly PeriodFrom,
    DateOnly PeriodThrough,
    DateOnly ApplicationDate,
    decimal OriginalContractSum,
    decimal NetChangeByChangeOrders,
    decimal ContractSumToDate,
    decimal TotalCompletedAndStoredToDate,
    decimal RetainageOnCompletedWork,
    decimal RetainageOnStoredMaterials,
    decimal TotalRetainage,
    decimal RetainagePercentWork,
    decimal RetainagePercentMaterials,
    decimal TotalEarnedLessRetainage,
    decimal LessPreviousCertificates,
    decimal CurrentPaymentDue,
    decimal BalanceToFinishIncludingRetainage,
    BillingApplicationStatus Status,
    string? InternalNotes,
    string? BillingNarrative,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<BillingApplicationLineItemDto>? LineItems
);

public record BillingApplicationLineItemDto(
    Guid Id,
    Guid OwnerSOVLineItemId,
    string ItemNumber,
    string Description,
    decimal ScheduledValue,
    int SortOrder,
    decimal WorkCompletedPrevious,
    decimal WorkCompletedThisPeriod,
    decimal MaterialsStoredToDate,
    decimal TotalCompletedAndStored,
    decimal PercentComplete,
    decimal BalanceToFinish,
    decimal? RetainagePercent,
    decimal RetainageAmount
);

public record CreateBillingApplicationCommand(
    Guid OwnerContractId,
    Guid OwnerScheduleOfValuesId,
    DateOnly PeriodFrom,
    DateOnly PeriodThrough,
    DateOnly ApplicationDate
) : ICommand<BillingApplicationDto>;

public record UpdateBillingApplicationLineCommand(
    Guid BillingApplicationId,
    Guid LineItemId,
    decimal WorkCompletedThisPeriod,
    decimal MaterialsStoredToDate
) : ICommand<BillingApplicationLineItemDto>;

public record BulkUpdateBillingLinesCommand(
    Guid BillingApplicationId,
    IReadOnlyList<BulkLineUpdate> Lines
) : ICommand<BillingApplicationDto>;

public record BulkLineUpdate(
    Guid LineItemId,
    decimal WorkCompletedThisPeriod,
    decimal MaterialsStoredToDate
);

public record SubmitForReviewCommand(Guid BillingApplicationId) : ICommand<BillingApplicationDto>;
public record ApproveReviewCommand(Guid BillingApplicationId) : ICommand<BillingApplicationDto>;
public record RejectReviewCommand(Guid BillingApplicationId, string? Comments = null) : ICommand<BillingApplicationDto>;
public record SubmitToOwnerCommand(Guid BillingApplicationId) : ICommand<BillingApplicationDto>;
public record VoidBillingCommand(Guid BillingApplicationId) : ICommand<BillingApplicationDto>;

public record ListBillingApplicationsQuery(
    Guid? ProjectId = null,
    Guid? OwnerContractId = null,
    BillingApplicationStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListBillingApplicationsResult>;

public record ListBillingApplicationsResult(
    IReadOnlyList<BillingApplicationDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

// ── Billing Period DTOs ──

public record BillingPeriodDto(
    Guid Id,
    string Name,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    int BillingDeadlineDay,
    BillingPeriodStatus Status,
    string? Notes,
    DateTime CreatedAt
);

public record CreateBillingPeriodCommand(
    string Name,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    int BillingDeadlineDay = 25,
    string? Notes = null
) : ICommand<BillingPeriodDto>;

public record UpdateBillingPeriodCommand(
    Guid PeriodId,
    string? Name = null,
    int? BillingDeadlineDay = null,
    BillingPeriodStatus? Status = null,
    string? Notes = null
) : ICommand<BillingPeriodDto>;

public record ListBillingPeriodsQuery(
    BillingPeriodStatus? Status = null,
    int Page = 1,
    int PageSize = 25
) : IQuery<ListBillingPeriodsResult>;

public record ListBillingPeriodsResult(
    IReadOnlyList<BillingPeriodDto> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);
