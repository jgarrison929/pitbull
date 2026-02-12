using MediatR;
using Microsoft.EntityFrameworkCore;
using Pitbull.Contracts.Domain;
using Pitbull.Core.CQRS;
using Pitbull.Core.Data;

namespace Pitbull.Contracts.Features.DeletePaymentApplication;

public sealed class DeletePaymentApplicationHandler(PitbullDbContext db)
    : IRequestHandler<DeletePaymentApplicationCommand, Result<bool>>
{
    public async Task<Result<bool>> Handle(
        DeletePaymentApplicationCommand request,
        CancellationToken cancellationToken)
    {
        var payApp = await db.Set<PaymentApplication>()
            .FirstOrDefaultAsync(pa => pa.Id == request.Id, cancellationToken);

        if (payApp is null)
            return Result.Failure<bool>("Payment application not found", "NOT_FOUND");

        // Only allow deleting draft applications
        if (payApp.Status != PaymentApplicationStatus.Draft)
            return Result.Failure<bool>("Only draft payment applications can be deleted", "INVALID_STATUS");

        // Hard delete for draft applications
        db.Set<PaymentApplication>().Remove(payApp);

        await db.SaveChangesAsync(cancellationToken);

        return Result.Success(true);
    }
}
