using MediatR;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Features.UpdatePaymentApplication;

public record UpdatePaymentApplicationCommand(
    Guid Id,
    decimal WorkCompletedThisPeriod,
    decimal StoredMaterials,
    PaymentApplicationStatus Status,
    string? ApprovedBy,
    decimal? ApprovedAmount,
    string? InvoiceNumber,
    string? CheckNumber,
    string? Notes
) : IRequest<Result<PaymentApplicationDto>>;
