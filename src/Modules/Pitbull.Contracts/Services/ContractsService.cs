using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Contracts.Features.CreateSubcontract;
using Pitbull.Contracts.Features.DeleteChangeOrder;
using Pitbull.Contracts.Features.DeletePaymentApplication;
using Pitbull.Contracts.Features.DeleteSubcontract;
using Pitbull.Contracts.Features.GetChangeOrder;
using Pitbull.Contracts.Features.GetPaymentApplication;
using Pitbull.Contracts.Features.GetSubcontract;
using Pitbull.Contracts.Features.ListChangeOrders;
using Pitbull.Contracts.Features.ListPaymentApplications;
using Pitbull.Contracts.Features.ListSubcontracts;
using Pitbull.Contracts.Features.UpdateChangeOrder;
using Pitbull.Contracts.Features.UpdatePaymentApplication;
using Pitbull.Contracts.Features.UpdateSubcontract;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Services;

/// <summary>
/// Implementation of contracts service with direct database access.
/// </summary>
public class ContractsService(PitbullDbContext db) : IContractsService
{
    // Subcontracts
    public async Task<Result<SubcontractDto>> GetSubcontractAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var subcontract = await db.Set<Subcontract>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, cancellationToken);

        if (subcontract is null)
            return Result.Failure<SubcontractDto>("Subcontract not found", "NOT_FOUND");

        return Result.Success(MapSubcontractToDto(subcontract));
    }

    public async Task<Result<PagedResult<SubcontractDto>>> ListSubcontractsAsync(ListSubcontractsQuery query, CancellationToken cancellationToken = default)
    {
        var dbQuery = db.Set<Subcontract>().AsNoTracking().Where(s => !s.IsDeleted);

        // Filter by project
        if (query.ProjectId.HasValue)
            dbQuery = dbQuery.Where(s => s.ProjectId == query.ProjectId.Value);

        // Filter by status
        if (query.Status.HasValue)
            dbQuery = dbQuery.Where(s => s.Status == query.Status.Value);

        // Search by subcontractor name or number
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.ToLower();
            dbQuery = dbQuery.Where(s =>
                s.SubcontractorName.ToLower().Contains(search.ToLower()) ||
                s.SubcontractNumber.ToLower().Contains(search));
        }

        var totalCount = await dbQuery.CountAsync(cancellationToken);

        var items = await dbQuery
            .OrderByDescending(s => s.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(s => MapSubcontractToDto(s))
            .ToListAsync(cancellationToken);

        return Result.Success(new PagedResult<SubcontractDto>(
            items, totalCount, query.Page, query.PageSize));
    }

    public async Task<Result<SubcontractDto>> CreateSubcontractAsync(CreateSubcontractCommand command, CancellationToken cancellationToken = default)
    {
        var handler = new CreateSubcontractHandler(db);
        return await handler.Handle(command, cancellationToken);
    }

    public async Task<Result<SubcontractDto>> UpdateSubcontractAsync(UpdateSubcontractCommand command, CancellationToken cancellationToken = default)
    {
        var handler = new UpdateSubcontractHandler(db);
        return await handler.Handle(command, cancellationToken);
    }

    public async Task<Result> DeleteSubcontractAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var handler = new DeleteSubcontractHandler(db);
        return await handler.Handle(new DeleteSubcontractCommand(id), cancellationToken);
    }

    // Change Orders
    public async Task<Result<ChangeOrderDto>> GetChangeOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var handler = new GetChangeOrderHandler(db);
        return await handler.Handle(new GetChangeOrderQuery(id), cancellationToken);
    }

    public async Task<Result<PagedResult<ChangeOrderDto>>> ListChangeOrdersAsync(ListChangeOrdersQuery query, CancellationToken cancellationToken = default)
    {
        var handler = new ListChangeOrdersHandler(db);
        return await handler.Handle(query, cancellationToken);
    }

    public async Task<Result<ChangeOrderDto>> CreateChangeOrderAsync(CreateChangeOrderCommand command, CancellationToken cancellationToken = default)
    {
        var handler = new CreateChangeOrderHandler(db);
        return await handler.Handle(command, cancellationToken);
    }

    public async Task<Result<ChangeOrderDto>> UpdateChangeOrderAsync(UpdateChangeOrderCommand command, CancellationToken cancellationToken = default)
    {
        var handler = new UpdateChangeOrderHandler(db);
        return await handler.Handle(command, cancellationToken);
    }

    public async Task<Result> DeleteChangeOrderAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var handler = new DeleteChangeOrderHandler(db);
        return await handler.Handle(new DeleteChangeOrderCommand(id), cancellationToken);
    }

    // Payment Applications
    public async Task<Result<PaymentApplicationDto>> GetPaymentApplicationAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var handler = new GetPaymentApplicationHandler(db);
        return await handler.Handle(new GetPaymentApplicationQuery(id), cancellationToken);
    }

    public async Task<Result<PagedResult<PaymentApplicationDto>>> ListPaymentApplicationsAsync(ListPaymentApplicationsQuery query, CancellationToken cancellationToken = default)
    {
        var handler = new ListPaymentApplicationsHandler(db);
        return await handler.Handle(query, cancellationToken);
    }

    public async Task<Result<PaymentApplicationDto>> CreatePaymentApplicationAsync(CreatePaymentApplicationCommand command, CancellationToken cancellationToken = default)
    {
        var handler = new CreatePaymentApplicationHandler(db);
        return await handler.Handle(command, cancellationToken);
    }

    public async Task<Result<PaymentApplicationDto>> UpdatePaymentApplicationAsync(UpdatePaymentApplicationCommand command, CancellationToken cancellationToken = default)
    {
        var handler = new UpdatePaymentApplicationHandler(db);
        return await handler.Handle(command, cancellationToken);
    }

    public async Task<Result> DeletePaymentApplicationAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var handler = new DeletePaymentApplicationHandler(db);
        return await handler.Handle(new DeletePaymentApplicationCommand(id), cancellationToken);
    }

    // Private mapping methods
    private static SubcontractDto MapSubcontractToDto(Subcontract s) => new(
        s.Id,
        s.ProjectId,
        s.SubcontractNumber,
        s.SubcontractorName,
        s.SubcontractorContact,
        s.SubcontractorEmail,
        s.SubcontractorPhone,
        s.SubcontractorAddress,
        s.ScopeOfWork,
        s.TradeCode,
        s.OriginalValue,
        s.CurrentValue,
        s.BilledToDate,
        s.PaidToDate,
        s.RetainagePercent,
        s.RetainageHeld,
        s.ExecutionDate,
        s.StartDate,
        s.CompletionDate,
        s.ActualCompletionDate,
        s.Status,
        s.InsuranceExpirationDate,
        s.InsuranceCurrent,
        s.LicenseNumber,
        s.Notes,
        s.CreatedAt
    );
}
