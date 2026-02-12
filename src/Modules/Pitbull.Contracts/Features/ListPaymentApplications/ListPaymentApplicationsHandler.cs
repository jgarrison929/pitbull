using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.ListPaymentApplications;

public sealed class ListPaymentApplicationsHandler(PitbullDbContext db)
    : IRequestHandler<ListPaymentApplicationsQuery, Result<PagedResult<PaymentApplicationDto>>>
{
    public async Task<Result<PagedResult<PaymentApplicationDto>>> Handle(
        ListPaymentApplicationsQuery request,
        CancellationToken cancellationToken)
    {
        var query = db.Set<PaymentApplication>().Where(pa => !pa.IsDeleted).AsQueryable();

        if (request.SubcontractId.HasValue)
            query = query.Where(pa => pa.SubcontractId == request.SubcontractId.Value);

        if (request.Status.HasValue)
            query = query.Where(pa => pa.Status == request.Status.Value);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(pa => pa.ApplicationNumber)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(CreatePaymentApplicationHandler.MapToDto).ToList();

        return Result.Success(
            new PagedResult<PaymentApplicationDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}
