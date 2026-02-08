using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Contracts.Features.CreatePaymentApplication;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.GetPaymentApplication;

public sealed class GetPaymentApplicationHandler(PitbullDbContext db) 
    : IRequestHandler<GetPaymentApplicationQuery, Result<PaymentApplicationDto>>
{
    public async Task<Result<PaymentApplicationDto>> Handle(
        GetPaymentApplicationQuery request, 
        CancellationToken cancellationToken)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == request.Id, cancellationToken);

        if (payApp is null)
            return Result.Failure<PaymentApplicationDto>("Payment application not found", "NOT_FOUND");

        return Result.Success(CreatePaymentApplicationHandler.MapToDto(payApp));
    }
}
