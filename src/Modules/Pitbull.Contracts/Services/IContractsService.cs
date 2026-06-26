using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.GetChangeOrder;
using Pitbull.Contracts.Features.GetPaymentApplication;
using Pitbull.Contracts.Features.GetSubcontract;
using Pitbull.Contracts.Features.ListChangeOrders;
using Pitbull.Contracts.Features.ListPaymentApplications;
using Pitbull.Contracts.Features.ListSubcontracts;
using Pitbull.Contracts.Features.OwnerChangeOrders;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Contracts.Features.UpdateSubcontract;
using Pitbull.Core.CQRS;

namespace Pitbull.Contracts.Services;

/// <summary>
/// Service for managing construction contracts including subcontracts,
/// change orders, and payment applications.
/// </summary>
public interface IContractsService
{
    // Subcontracts
    Task<Result<SubcontractDto>> GetSubcontractAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<SubcontractDto>>> ListSubcontractsAsync(ListSubcontractsQuery query, CancellationToken cancellationToken = default);
    Task<Result<SubcontractDto>> CreateSubcontractAsync(CreateSubcontractCommand command, CancellationToken cancellationToken = default);
    Task<Result<SubcontractDto>> UpdateSubcontractAsync(UpdateSubcontractCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteSubcontractAsync(Guid id, CancellationToken cancellationToken = default);

    // Change Orders
    Task<Result<ChangeOrderDto>> GetChangeOrderAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<ChangeOrderDto>>> ListChangeOrdersAsync(ListChangeOrdersQuery query, CancellationToken cancellationToken = default);
    Task<Result<ChangeOrderDto>> CreateChangeOrderAsync(CreateChangeOrderCommand command, CancellationToken cancellationToken = default);
    Task<Result<ChangeOrderDto>> UpdateChangeOrderAsync(UpdateChangeOrderCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteChangeOrderAsync(Guid id, CancellationToken cancellationToken = default);

    // Owner Change Orders
    Task<Result<OwnerChangeOrderDto>> GetOwnerChangeOrderAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<OwnerChangeOrderDto>>> ListOwnerChangeOrdersAsync(ListOwnerChangeOrdersQuery query, CancellationToken cancellationToken = default);
    Task<Result<OwnerChangeOrderDto>> CreateOwnerChangeOrderAsync(CreateOwnerChangeOrderCommand command, CancellationToken cancellationToken = default);
    Task<Result<OwnerChangeOrderDto>> UpdateOwnerChangeOrderAsync(UpdateOwnerChangeOrderCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeleteOwnerChangeOrderAsync(Guid id, CancellationToken cancellationToken = default);

    // Payment Applications
    Task<Result<PaymentApplicationDto>> GetPaymentApplicationAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<PagedResult<PaymentApplicationDto>>> ListPaymentApplicationsAsync(ListPaymentApplicationsQuery query, CancellationToken cancellationToken = default);
    Task<Result<PaymentApplicationDto>> CreatePaymentApplicationAsync(CreatePaymentApplicationCommand command, CancellationToken cancellationToken = default);
    Task<Result<PaymentApplicationDto>> UpdatePaymentApplicationAsync(UpdatePaymentApplicationCommand command, CancellationToken cancellationToken = default);
    Task<Result> DeletePaymentApplicationAsync(Guid id, CancellationToken cancellationToken = default);
}
