using MediatR;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.CreatePaymentApplication;

public record CreatePaymentApplicationCommand(
    Guid SubcontractId,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    decimal WorkCompletedThisPeriod,
    decimal StoredMaterials,
    string? InvoiceNumber,
    string? Notes
) : IRequest<Result<PaymentApplicationDto>>;

public record PaymentApplicationDto(
    Guid Id,
    Guid SubcontractId,
    int ApplicationNumber,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    decimal ScheduledValue,
    decimal WorkCompletedPrevious,
    decimal WorkCompletedThisPeriod,
    decimal WorkCompletedToDate,
    decimal StoredMaterials,
    decimal TotalCompletedAndStored,
    decimal RetainagePercent,
    decimal RetainageThisPeriod,
    decimal RetainagePrevious,
    decimal TotalRetainage,
    decimal TotalEarnedLessRetainage,
    decimal LessPreviousCertificates,
    decimal CurrentPaymentDue,
    PaymentApplicationStatus Status,
    DateTime? SubmittedDate,
    DateTime? ReviewedDate,
    DateTime? ApprovedDate,
    DateTime? PaidDate,
    string? ApprovedBy,
    decimal? ApprovedAmount,
    string? Notes,
    string? InvoiceNumber,
    string? CheckNumber,
    DateTime CreatedAt
);
