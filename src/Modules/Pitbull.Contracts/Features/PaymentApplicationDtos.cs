using Pitbull.Contracts.Domain;

namespace Pitbull.Contracts.Features;

// === G702 Summary DTO ===

public sealed record PaymentApplicationG702Dto(
    decimal OriginalContractSum,
    decimal NetChangeByChangeOrders,
    decimal ContractSumToDate,
    decimal TotalCompletedAndStoredToDate,
    decimal RetainageToDate,
    decimal TotalEarnedLessRetainage,
    decimal LessPreviousCertificates,
    decimal CurrentPaymentDue,
    decimal BalanceToFinish
);

// === G703 Line Item DTOs ===

public sealed record PaymentApplicationLineItemDto(
    Guid Id,
    Guid SOVLineItemId,
    string ItemNumber,
    string Description,
    decimal ScheduledValue,
    decimal WorkCompletedPrevious,
    decimal WorkCompletedThisPeriod,
    decimal MaterialsStoredPrevious,
    decimal MaterialsStoredThisPeriod,
    decimal TotalCompletedAndStoredToDate,
    decimal PercentComplete,
    decimal BalanceToFinish,
    decimal RetainagePercent,
    decimal RetainageAmount,
    int SortOrder
);

public sealed record PaymentApplicationLineItemInputDto(
    Guid SOVLineItemId,
    decimal WorkCompletedThisPeriod,
    decimal MaterialsStoredThisPeriod,
    decimal? RetainagePercentOverride
);

// === Book Entry DTO ===

public sealed record PaymentApplicationBookEntryDto(
    Guid Id,
    AccountingBookType BookType,
    decimal EarnedRevenueToDate,
    decimal CurrentPeriodRevenue,
    decimal BillingsToDate,
    decimal CurrentPeriodBilling,
    decimal RetainageHeldToDate,
    decimal OverUnderBilling,
    DateTime GeneratedAt
);

// === Detail DTO (full pay app with G702/G703/books) ===

public sealed record PaymentApplicationDetailDto(
    Guid Id,
    Guid SubcontractId,
    Guid? ScheduleOfValuesId,
    int ApplicationNumber,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    PaymentApplicationStatus Status,
    decimal CurrentPaymentDue,
    decimal TotalCompletedAndStored,
    decimal TotalRetainage,
    decimal RetainagePercent,
    decimal? PaidAmount,
    DateTime? SubmittedDate,
    DateTime? ReviewedDate,
    DateTime? ApprovedDate,
    DateTime? PaidDate,
    string? ApprovedBy,
    string? ReviewedBy,
    string? InvoiceNumber,
    string? CheckNumber,
    string? Notes,
    PaymentApplicationG702Dto G702,
    IReadOnlyList<PaymentApplicationLineItemDto> G703LineItems,
    IReadOnlyList<PaymentApplicationBookEntryDto> BookEntries
);

// === Request DTOs ===

public sealed record UpdatePaymentApplicationLineItemsRequest(
    IReadOnlyList<PaymentApplicationLineItemInputDto> Items,
    bool RecalculateTotals = true
);

public sealed record ReviewPaymentApplicationRequest(
    string ReviewedBy,
    string? Notes
);

public sealed record ApprovePaymentApplicationRequest(
    string ApprovedBy,
    decimal? ApprovedAmount,
    DateOnly? RevenueRecognitionDate,
    string? Notes
);

public sealed record MarkPaymentApplicationPaidRequest(
    decimal PaidAmount,
    DateTime PaidDate,
    string PaymentReference,
    string? CheckNumber,
    string? Notes
);

public sealed record CreatePaymentApplicationFromSovRequest(
    DateTime PeriodStart,
    DateTime PeriodEnd,
    string? InvoiceNumber,
    string? Notes
);

// === Settings DTOs ===

public sealed record PaymentApplicationSettingsDto(
    decimal DefaultRetainagePercent,
    bool EnableApprovalWorkflow,
    bool RequireSignedSubcontract,
    bool AllowRetainageOverride,
    bool AllowRetainageReleaseBeforeFinal,
    string DefaultBookMode,
    bool LockSubmittedLineItems,
    bool RequireLienWaiverBeforePaid
);

public sealed record UpdatePaymentApplicationSettingsRequest(
    decimal DefaultRetainagePercent,
    bool EnableApprovalWorkflow,
    bool RequireSignedSubcontract,
    bool AllowRetainageOverride,
    bool AllowRetainageReleaseBeforeFinal,
    string DefaultBookMode,
    bool LockSubmittedLineItems,
    bool RequireLienWaiverBeforePaid
);
