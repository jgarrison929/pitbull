using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreateChangeOrder;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.GetChangeOrder;

public sealed class GetChangeOrderHandler(PitbullDbContext db) 
    : IRequestHandler<GetChangeOrderQuery, Result<ChangeOrderDto>>
{
    public async Task<Result<ChangeOrderDto>> Handle(
        GetChangeOrderQuery request, 
        CancellationToken cancellationToken)
    {
        var changeOrder = await db.Set<ChangeOrder>()
            .FirstOrDefaultAsync(co => co.Id == request.Id, cancellationToken);

        if (changeOrder is null)
            return Result.Failure<ChangeOrderDto>("Change order not found", "NOT_FOUND");

        return Result.Success(new ChangeOrderDto(
            changeOrder.Id,
            changeOrder.SubcontractId,
            changeOrder.ChangeOrderNumber,
            changeOrder.Title,
            changeOrder.Description,
            changeOrder.Reason,
            changeOrder.Amount,
            changeOrder.DaysExtension,
            changeOrder.Status,
            changeOrder.SubmittedDate,
            changeOrder.ApprovedDate,
            changeOrder.RejectedDate,
            changeOrder.ApprovedBy,
            changeOrder.RejectedBy,
            changeOrder.RejectionReason,
            changeOrder.ReferenceNumber,
            changeOrder.CreatedAt
        ));
    }
}
