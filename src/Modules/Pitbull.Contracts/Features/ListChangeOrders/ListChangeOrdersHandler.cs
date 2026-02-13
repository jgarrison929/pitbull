using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.ListChangeOrders;

public sealed class ListChangeOrdersHandler(PitbullDbContext db)
    : IRequestHandler<ListChangeOrdersQuery, Result<PagedResult<ChangeOrderDto>>>
{
    public async Task<Result<PagedResult<ChangeOrderDto>>> Handle(
        ListChangeOrdersQuery request,
        CancellationToken cancellationToken)
    {
        var query = db.Set<ChangeOrder>().Where(co => !co.IsDeleted).AsQueryable();

        // Filter by subcontract
        if (request.SubcontractId.HasValue)
            query = query.Where(co => co.SubcontractId == request.SubcontractId.Value);

        // Filter by status
        if (request.Status.HasValue)
            query = query.Where(co => co.Status == request.Status.Value);

        // Search by title or CO number
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.ToLower();
            query = query.Where(co =>
                co.Title.Contains(search, StringComparison.CurrentCultureIgnoreCase) ||
                co.ChangeOrderNumber.Contains(search, StringComparison.CurrentCultureIgnoreCase));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(co => co.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(co => new ChangeOrderDto(
                co.Id,
                co.SubcontractId,
                co.ChangeOrderNumber,
                co.Title,
                co.Description,
                co.Reason,
                co.Amount,
                co.DaysExtension,
                co.Status,
                co.SubmittedDate,
                co.ApprovedDate,
                co.RejectedDate,
                co.ApprovedBy,
                co.RejectedBy,
                co.RejectionReason,
                co.ReferenceNumber,
                co.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return Result.Success(
            new PagedResult<ChangeOrderDto>(items, totalCount, request.Page, request.PageSize));
    }
}
